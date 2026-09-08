/**
 * End-to-End Security & Redaction Test for DSH Supreme
 * Confirms that credentials and sentinels are never persisted to disk or emitted in logs.
 */
import { Context } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import SupremeMemoryPolicyPlugin from '../../plugins/supreme-memory-policy/src/index.ts';
import SupremeObservabilityPlugin from '../../plugins/supreme-observability/src/index.ts';
import SupremeVerifierPlugin from '../../plugins/supreme-verifier/src/index.ts';

export async function runSecurityRedactionTests() {
  console.log('--- RUNNING SECURITY & REDACTION TESTS ---');
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

  const SENTINEL_API_KEY = 'SENTINEL_SECRET_API_KEY_AI_STUDIO_99999';
  const SENTINEL_BEARER = 'Bearer sk-ant-api03-SECRET_BEARER_SENTINEL';
  const testTracePath = path.resolve(process.cwd(), 'dsh-supreme/data/observability/security-traces.jsonl');

  if (fs.existsSync(testTracePath)) fs.unlinkSync(testTracePath);

  const ctx = new Context();
  const fObs = await ctx.plugin(SupremeObservabilityPlugin, {
    enabled: true,
    logPath: testTracePath,
    bufferFlushIntervalMs: 50,
  });
  const fVer = await ctx.plugin(SupremeVerifierPlugin, {});
  const fMem = await ctx.plugin(SupremeMemoryPolicyPlugin, {});

  // 1. Observability Redaction Test
  ctx.supremeObservability.recordEvent({
    event_id: 'sec-evt-1',
    timestamp: new Date().toISOString(),
    type: 'tool:finish',
    tool_name: 'git_commit',
    metadata: {
      authHeader: SENTINEL_BEARER,
      apiKey: SENTINEL_API_KEY,
      rawToken: 'token=SECRET_VALUE_12345',
      safeCount: 42,
    },
  });
  ctx.supremeObservability.flushSync();

  const traceFileText = fs.readFileSync(testTracePath, 'utf8');
  assert(!traceFileText.includes(SENTINEL_API_KEY), 'SENTINEL_API_KEY was not leaked into traces.jsonl');
  assert(!traceFileText.includes(SENTINEL_BEARER), 'SENTINEL_BEARER was not leaked into traces.jsonl');
  assert(traceFileText.includes('[REDACTED_BY_SUPREME_OBSERVABILITY]'), 'Sensitive attributes replaced with redacted sentinel');

  // 2. Verifier Redaction Test
  const verResult = await ctx.supremeVerifier.verify('default:exact-text', SENTINEL_API_KEY, { expected: 'something-else' });
  assert(!verResult.evidence.includes(SENTINEL_API_KEY), 'Verifier evidence output automatically redacts sentinel tokens');

  // 3. Memory Security Gate Test
  let memoryBlocked = false;
  try {
    ctx.supremeMemoryPolicy.registerProjectKnowledge({
      id: 'k-leak',
      content: `Here is the production secret token=${SENTINEL_API_KEY}`,
      source: 'config.ts',
      priority: 100,
    });
  } catch {
    memoryBlocked = true;
  }
  assert(memoryBlocked === true, 'Memory policy strictly blocked registration of secret-bearing content');

  // Clean up
  await fObs.dispose();
  await fVer.dispose();
  await fMem.dispose();

  if (fs.existsSync(testTracePath)) fs.unlinkSync(testTracePath);

  console.log(`\nSecurity Redaction Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-security-redaction.ts')) {
  runSecurityRedactionTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
