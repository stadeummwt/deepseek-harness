/**
 * @license
 * @dsh-supreme/verifier
 * Deterministic evidence validation registry for DeepSeek Harness.
 */

import { Context, Service } from 'cordis';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { ValidatorResult, ValidatorType } from '../../types.ts';

export interface ValidatorDefinition {
  validator_id: string;
  type: ValidatorType;
  description?: string;
  expected?: any;
  predicate?: (input: any) => boolean | Promise<boolean>;
}

export interface SupremeVerifierConfig {
  maxEvidenceLength?: number;
  timeoutMs?: number;
}

export class SupremeVerifierService extends Service {
  static provide = 'supremeVerifier';
  public config: Required<SupremeVerifierConfig>;
  private validators: Map<string, ValidatorDefinition> = new Map();

  constructor(ctx: Context, config: SupremeVerifierConfig = {}) {
    super(ctx, 'supremeVerifier');

    this.config = {
      maxEvidenceLength: config.maxEvidenceLength ?? 500,
      timeoutMs: config.timeoutMs ?? 5000,
    };

    this.registerDefaultValidators();
  }

  private registerDefaultValidators() {
    // 1. Exact text validator
    this.registerValidator({
      validator_id: 'default:exact-text',
      type: 'exact-text',
      description: 'Checks for exact string equality',
    });

    // 2. JSON parse validator
    this.registerValidator({
      validator_id: 'default:json-parse',
      type: 'json-parse',
      description: 'Validates that the input is well-formed JSON',
    });
  }

  public registerValidator(def: ValidatorDefinition): void {
    this.validators.set(def.validator_id, def);
  }

  public getValidator(validatorId: string): ValidatorDefinition | undefined {
    return this.validators.get(validatorId);
  }

  public listValidators(): ValidatorDefinition[] {
    return Array.from(this.validators.values());
  }

  /**
   * Run verification using registered validator
   */
  public async verify(
    validatorId: string,
    target: any,
    options?: { expected?: any; customPredicate?: (val: any) => boolean }
  ): Promise<ValidatorResult> {
    const startTime = Date.now();
    const def = this.validators.get(validatorId);

    if (!def) {
      return {
        validator_id: validatorId,
        status: 'UNAVAILABLE',
        evidence: `Validator '${validatorId}' is not registered`,
        duration_ms: Date.now() - startTime,
        reason_code: 'VALIDATOR_NOT_FOUND',
      };
    }

    try {
      let status: 'PASS' | 'FAIL' | 'ERROR' | 'UNAVAILABLE' = 'FAIL';
      let evidence = '';
      let reasonCode = 'VERIFICATION_FAILED';

      const expected = options?.expected ?? def.expected;

      switch (def.type) {
        case 'exact-text': {
          const strTarget = String(target ?? '');
          const strExpected = String(expected ?? '');
          const matches = strTarget.trim() === strExpected.trim();
          status = matches ? 'PASS' : 'FAIL';
          evidence = matches ? 'Exact text matches expected string' : `Received '${strTarget.slice(0, 50)}...', expected '${strExpected.slice(0, 50)}...'`;
          reasonCode = matches ? 'EXACT_MATCH_SUCCESS' : 'EXACT_MATCH_MISMATCH';
          break;
        }

        case 'regex': {
          const pattern = expected instanceof RegExp ? expected : new RegExp(String(expected));
          const matches = pattern.test(String(target ?? ''));
          status = matches ? 'PASS' : 'FAIL';
          evidence = matches ? `Target matched regex pattern ${pattern}` : `Target failed regex pattern ${pattern}`;
          reasonCode = matches ? 'REGEX_MATCH_SUCCESS' : 'REGEX_MISMATCH';
          break;
        }

        case 'json-parse': {
          try {
            JSON.parse(typeof target === 'string' ? target : JSON.stringify(target));
            status = 'PASS';
            evidence = 'Valid JSON parsed without syntax errors';
            reasonCode = 'JSON_PARSE_SUCCESS';
          } catch (e: any) {
            status = 'FAIL';
            evidence = `JSON parse failed: ${e.message}`;
            reasonCode = 'JSON_PARSE_SYNTAX_ERROR';
          }
          break;
        }

        case 'json-schema': {
          try {
            const parsed = typeof target === 'string' ? JSON.parse(target) : target;
            if (typeof expected === 'object' && expected !== null && expected.required) {
              const missing = (expected.required as string[]).filter((key) => !(key in parsed));
              if (missing.length === 0) {
                status = 'PASS';
                evidence = 'All required JSON schema keys present';
                reasonCode = 'SCHEMA_VALID';
              } else {
                status = 'FAIL';
                evidence = `Missing required keys: [${missing.join(', ')}]`;
                reasonCode = 'SCHEMA_MISSING_KEYS';
              }
            } else {
              status = 'PASS';
              evidence = 'Basic schema validated';
              reasonCode = 'SCHEMA_VALID';
            }
          } catch (e: any) {
            status = 'FAIL';
            evidence = `Schema check error: ${e.message}`;
            reasonCode = 'SCHEMA_PARSE_ERROR';
          }
          break;
        }

        case 'file-exists': {
          const filePath = String(target);
          const exists = fs.existsSync(filePath);
          status = exists ? 'PASS' : 'FAIL';
          evidence = exists ? `File exists at '${filePath}'` : `File does not exist at '${filePath}'`;
          reasonCode = exists ? 'FILE_FOUND' : 'FILE_NOT_FOUND';
          break;
        }

        case 'file-hash': {
          const filePath = String(target);
          if (!fs.existsSync(filePath)) {
            status = 'FAIL';
            evidence = `File not found for hash check: ${filePath}`;
            reasonCode = 'FILE_NOT_FOUND';
          } else {
            const buf = fs.readFileSync(filePath);
            const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
            const expectedHash = String(expected || '').toLowerCase();
            const matches = actualHash === expectedHash;
            status = matches ? 'PASS' : 'FAIL';
            evidence = matches ? `SHA256 hash verified: ${actualHash}` : `Hash mismatch: expected ${expectedHash}, got ${actualHash}`;
            reasonCode = matches ? 'HASH_MATCH' : 'HASH_MISMATCH';
          }
          break;
        }

        case 'command-exit': {
          const exitCode = Number(target);
          const expectedCode = expected !== undefined ? Number(expected) : 0;
          const matches = exitCode === expectedCode;
          status = matches ? 'PASS' : 'FAIL';
          evidence = `Process exited with code ${exitCode} (expected ${expectedCode})`;
          reasonCode = matches ? 'EXIT_SUCCESS' : 'EXIT_NONZERO';
          break;
        }

        case 'custom': {
          const fn = options?.customPredicate || def.predicate;
          if (!fn) {
            status = 'UNAVAILABLE';
            evidence = 'Custom validator predicate is not provided';
            reasonCode = 'PREDICATE_MISSING';
          } else {
            const res = await fn(target);
            status = res ? 'PASS' : 'FAIL';
            evidence = res ? 'Custom predicate evaluated to true' : 'Custom predicate evaluated to false';
            reasonCode = res ? 'CUSTOM_PREDICATE_PASS' : 'CUSTOM_PREDICATE_FAIL';
          }
          break;
        }

        default:
          status = 'UNAVAILABLE';
          evidence = `Validator type '${def.type}' is unsupported`;
          reasonCode = 'UNSUPPORTED_TYPE';
      }

      // Sanitize evidence from any secret patterns
      const sanitizedEvidence = evidence
        .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, '[REDACTED]')
        .replace(/SENTINEL_SECRET[a-zA-Z0-9_]*/g, '[REDACTED]')
        .slice(0, this.config.maxEvidenceLength);

      return {
        validator_id: validatorId,
        status,
        evidence: sanitizedEvidence,
        duration_ms: Date.now() - startTime,
        reason_code: reasonCode,
      };
    } catch (err: any) {
      // Validator internal exception -> ERROR, never crash caller
      return {
        validator_id: validatorId,
        status: 'ERROR',
        evidence: `Validator internal error: ${err.message}`.slice(0, this.config.maxEvidenceLength),
        duration_ms: Date.now() - startTime,
        reason_code: 'VALIDATOR_INTERNAL_EXCEPTION',
      };
    }
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeVerifier: SupremeVerifierService;
  }
}

export const SupremeVerifierPlugin = SupremeVerifierService;
export default SupremeVerifierPlugin;
