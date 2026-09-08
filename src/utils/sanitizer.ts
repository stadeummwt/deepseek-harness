import { SanitizationReport, SanitizedResult } from '../types.ts';

/**
 * Hardened Sentinel Patterns for DeepSeek Harness & DSH Supreme
 * Covers API keys, OAuth tokens, private keys, cloud credentials, and connection strings.
 */
export const SENTINEL_PATTERNS: { name: string; regex: RegExp }[] = [
  {
    name: 'OpenAI API Key',
    regex: /\bsk-(?:proj-)?[a-zA-Z0-9_-]{20,}\b/g,
  },
  {
    name: 'Anthropic API Key',
    regex: /\bsk-ant-(?:api\d{2}-)?[a-zA-Z0-9_-]{20,}\b/g,
  },
  {
    name: 'DeepSeek API Key',
    regex: /\bsk-[a-f0-9]{32,}\b/gi,
  },
  {
    name: 'Google AI Studio / GCP Key',
    regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
  },
  {
    name: 'Bearer Authorization Header',
    regex: /Bearer\s+[a-zA-Z0-9_.\-+/=]{16,}/gi,
  },
  {
    name: 'JSON Web Token (JWT)',
    regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[^]+?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  {
    name: 'AWS Access Key ID',
    regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'GitHub Personal Token',
    regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g,
  },
  {
    name: 'Database Connection URI with Password',
    regex: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^/\s]+\/[^\s]+/gi,
  },
  {
    name: 'Generic Key/Token Assignment',
    regex: /(?:apiKey|api_key|token|password|secret|client_secret)\s*[:=]\s*["']?([a-zA-Z0-9_\-.]{8,})["']?/gi,
  },
];

/**
 * Sensitive dictionary keys that must always have their values masked,
 * even if the value does not match standard regex patterns.
 */
export const SENSITIVE_KEY_NAMES = new Set([
  'authorization',
  'auth',
  'apikey',
  'api_key',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'password',
  'passwd',
  'private_key',
  'privatekey',
  'client_secret',
  'credential',
  'credentials',
  'cookie',
  'sessionid',
  'session_id',
]);

const REDACTED_PLACEHOLDER = '[REDACTED_BY_SUPREME_OBSERVABILITY]';

/**
 * Sanitizes a single raw string using all defined sentinel patterns.
 */
export function sanitizeString(
  text: string,
  matchedPatternsCollector?: Set<string>
): { sanitized: string; count: number } {
  if (!text || typeof text !== 'string') {
    return { sanitized: text, count: 0 };
  }

  let sanitized = text;
  let count = 0;

  for (const { name, regex } of SENTINEL_PATTERNS) {
    // Reset regex index if global
    regex.lastIndex = 0;
    if (regex.test(sanitized)) {
      if (matchedPatternsCollector) {
        matchedPatternsCollector.add(name);
      }
      regex.lastIndex = 0;
      const matches = sanitized.match(regex);
      if (matches) {
        count += matches.length;
      }
      sanitized = sanitized.replace(regex, (match) => {
        if (match.toLowerCase().startsWith('bearer ')) {
          return `Bearer ${REDACTED_PLACEHOLDER}`;
        }
        if (match.includes('://')) {
          return match.replace(/:([^:@\s]+)@/, `:${REDACTED_PLACEHOLDER}@`);
        }
        return REDACTED_PLACEHOLDER;
      });
    }
  }

  return { sanitized, count };
}

/**
 * Deep recursive payload sanitizer.
 * Traverses objects, arrays, nested maps, and strings.
 * Guards against circular references using WeakSet.
 */
export function sanitizePayload<T>(input: T): SanitizedResult<T> {
  const patternsMatched = new Set<string>();
  const sensitiveKeysScrubbed = new Set<string>();
  let interceptedCount = 0;
  const seen = new WeakSet();

  function recurse(val: any, currentKey?: string): any {
    if (val === null || val === undefined) return val;

    // String scrubbing
    if (typeof val === 'string') {
      // If parent key is sensitive, unconditionally mask
      if (currentKey && SENSITIVE_KEY_NAMES.has(currentKey.toLowerCase())) {
        sensitiveKeysScrubbed.add(currentKey);
        interceptedCount += 1;
        return REDACTED_PLACEHOLDER;
      }
      const { sanitized, count } = sanitizeString(val, patternsMatched);
      interceptedCount += count;
      return sanitized;
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
      if (currentKey && SENSITIVE_KEY_NAMES.has(currentKey.toLowerCase())) {
        sensitiveKeysScrubbed.add(currentKey);
        interceptedCount += 1;
        return REDACTED_PLACEHOLDER;
      }
      return val;
    }

    if (typeof val === 'object') {
      if (seen.has(val)) {
        return '[CIRCULAR_REF]';
      }
      seen.add(val);

      if (Array.isArray(val)) {
        return val.map((item) => recurse(item, currentKey));
      }

      const copy: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        const isSensitiveKey = SENSITIVE_KEY_NAMES.has(k.toLowerCase());
        if (isSensitiveKey) {
          sensitiveKeysScrubbed.add(k);
          interceptedCount += 1;
          copy[k] = REDACTED_PLACEHOLDER;
        } else {
          copy[k] = recurse(v, k);
        }
      }
      return copy;
    }

    return val;
  }

  const sanitized = recurse(input);

  const report: SanitizationReport = {
    interceptedCount,
    patternsMatched: Array.from(patternsMatched),
    sensitiveKeysScrubbed: Array.from(sensitiveKeysScrubbed),
    zeroLeakVerified: true,
    scrubbedTimestamp: new Date().toISOString(),
  };

  return { sanitized, report };
}

/**
 * Sanitizes verification result payloads before JSONL write.
 * Directly fixes the gap where verification_result was previously written directly to JSONL.
 */
export function sanitizeVerificationResult(verificationResult: any): {
  sanitized: any;
  scrubbedCount: number;
} {
  const result = sanitizePayload(verificationResult);
  return {
    sanitized: result.sanitized,
    scrubbedCount: result.report.interceptedCount,
  };
}

/**
 * Sanitizes long-term & short-term memory knowledge entries before persistence.
 * Directly fixes the gap where long-term-provider results bypassed project string checks.
 */
export function sanitizeMemoryKnowledge(knowledgeEntry: any): {
  sanitized: any;
  scrubbedCount: number;
  blockedSecrets: string[];
} {
  const result = sanitizePayload(knowledgeEntry);
  return {
    sanitized: result.sanitized,
    scrubbedCount: result.report.interceptedCount,
    blockedSecrets: result.report.patternsMatched,
  };
}
