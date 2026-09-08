/**
 * Unit Test for @dsh-supreme/verifier
 */
import { Context } from 'cordis';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import SupremeVerifierPlugin from '../../plugins/supreme-verifier/src/index.ts';

export async function runVerifierTests() {
  console.log('--- RUNNING SUPREME VERIFIER TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  const ctx = new Context();
  const fiber = await ctx.plugin(SupremeVerifierPlugin, { maxEvidenceLength: 400 });
  const verifier = ctx.supremeVerifier;

  assert(!!verifier, 'supremeVerifier mounted on Context');

  // Test 1: Exact text validator
  const exactPass = await verifier.verify('default:exact-text', 'hello world', { expected: 'hello world' });
  assert(exactPass.status === 'PASS', 'Exact text validator PASS on identical text');

  const exactFail = await verifier.verify('default:exact-text', 'wrong text', { expected: 'hello world' });
  assert(exactFail.status === 'FAIL', 'Exact text validator FAIL on mismatched text without throwing');

  // Test 2: JSON Parse validator
  const jsonPass = await verifier.verify('default:json-parse', '{"status":"ok","code":200}');
  assert(jsonPass.status === 'PASS', 'JSON validator PASS on valid JSON');

  const jsonFail = await verifier.verify('default:json-parse', '{ invalid json syntax');
  assert(jsonFail.status === 'FAIL', 'JSON validator FAIL on malformed JSON');

  // Test 3: JSON Schema validator
  verifier.registerValidator({
    validator_id: 'user-schema-check',
    type: 'json-schema',
    expected: { required: ['id', 'username'] },
  });

  const schemaPass = await verifier.verify('user-schema-check', JSON.stringify({ id: 101, username: 'alice' }));
  assert(schemaPass.status === 'PASS', 'Schema validator PASS when all required keys are present');

  const schemaFail = await verifier.verify('user-schema-check', JSON.stringify({ id: 101 }));
  assert(schemaFail.status === 'FAIL', 'Schema validator FAIL when required key is missing');

  // Test 4: File Hash validator with temporary fixture
  const tempFixturePath = path.resolve(process.cwd(), 'dsh-supreme/benchmarks/fixtures/test-hash.txt');
  fs.mkdirSync(path.dirname(tempFixturePath), { recursive: true });
  fs.writeFileSync(tempFixturePath, 'DSH SUPREME DETERMINISTIC VERIFIER FIXTURE', 'utf8');
  const expectedHash = crypto.createHash('sha256').update('DSH SUPREME DETERMINISTIC VERIFIER FIXTURE').digest('hex');

  verifier.registerValidator({
    validator_id: 'fixture-hash-check',
    type: 'file-hash',
    expected: expectedHash,
  });

  const hashPass = await verifier.verify('fixture-hash-check', tempFixturePath);
  assert(hashPass.status === 'PASS', 'File hash validator verified correct SHA256 checksum');

  // Test 5: Unsupported validator returns UNAVAILABLE (not fake PASS)
  const unavailableRes = await verifier.verify('non-existent-validator-id', 'data');
  assert(unavailableRes.status === 'UNAVAILABLE', 'Unregistered validator returns UNAVAILABLE status');

  // Test 6: Secret Sentinel not emitted in evidence
  const SENTINEL = 'SENTINEL_SECRET_TOKEN_DO_NOT_LEAK_67890';
  const secretEvidenceRes = await verifier.verify('default:exact-text', SENTINEL, { expected: 'other' });
  assert(!secretEvidenceRes.evidence.includes(SENTINEL), 'Secret sentinel was sanitized from verifier evidence output');

  // Clean up fixture
  if (fs.existsSync(tempFixturePath)) {
    fs.unlinkSync(tempFixturePath);
  }

  // Test 7: Disposal
  await fiber.dispose();
  assert(ctx.supremeVerifier === undefined, 'Disposal cleans up supremeVerifier');

  console.log(`Verifier Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-verifier.ts')) {
  runVerifierTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
