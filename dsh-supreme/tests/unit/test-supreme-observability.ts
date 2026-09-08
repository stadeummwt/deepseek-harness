/**
 * Unit Test for @dsh-supreme/observability
 */
import { Context } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import SupremeObservabilityPlugin from '../../plugins/supreme-observability/src/index.ts';

export async function runObservabilityTests() {
  console.log('--- RUNNING SUPREME OBSERVABILITY TESTS ---');
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

  const testLogPath = path.resolve(process.cwd(), 'dsh-supreme/data/observability/test-traces.jsonl');
  if (fs.existsSync(testLogPath)) {
    fs.unlinkSync(testLogPath);
  }

  // Test 1: Service mounts and receives events
  const ctx = new Context();
  const fiber = await ctx.plugin(SupremeObservabilityPlugin, {
    enabled: true,
    logPath: testLogPath,
    bufferFlushIntervalMs: 100,
  });

  const obs = ctx.supremeObservability;
  assert(!!obs, 'supremeObservability service mounted on Context');

  // Test 2: Enabled writes safe event
  const recorded = obs.recordEvent({
    event_id: 'evt-test-1',
    timestamp: new Date().toISOString(),
    type: 'llm:response',
    provider: 'deepseek',
    model: 'deepseek-chat',
    latency_ms: 320,
    metadata: {
      tokens: 450,
      cached: true,
    },
  });
  assert(recorded === true, 'Safe event recorded successfully');

  // Test 3: Secret Sentinel Redaction
  const SENTINEL_SECRET = 'SENTINEL_SECRET_TOKEN_DO_NOT_LEAK_12345';
  obs.recordEvent({
    event_id: 'evt-secret-leak-attempt',
    timestamp: new Date().toISOString(),
    type: 'tool:call',
    tool_name: 'read_secret',
    metadata: {
      authorization: `Bearer ${SENTINEL_SECRET}`,
      apiKey: SENTINEL_SECRET,
      safeMetric: 99,
    },
  });

  // Flush to disk
  obs.flushSync();

  const fileContent = fs.readFileSync(testLogPath, 'utf8');
  assert(!fileContent.includes(SENTINEL_SECRET), 'SECRET SENTINEL was not leaked into the JSONL trace log');
  assert(fileContent.includes('[REDACTED_BY_SUPREME_OBSERVABILITY]'), 'Sensitive metadata was sanitized to redacted placeholder');

  // Test 4: Disabled mode is no-op
  const disabledCtx = new Context();
  await disabledCtx.plugin(SupremeObservabilityPlugin, { enabled: false });
  const disabledObs = disabledCtx.supremeObservability;
  const noopRes = disabledObs.recordEvent({
    event_id: 'evt-noop',
    timestamp: new Date().toISOString(),
    type: 'test:noop',
  });
  assert(noopRes === false, 'Disabled observability service returns false / no-op');

  // Test 5: Writer failure fails open
  const invalidPathCtx = new Context();
  await invalidPathCtx.plugin(SupremeObservabilityPlugin, {
    enabled: true,
    logPath: '/proc/illegal/cannot/write/here.jsonl',
  });
  const invalidObs = invalidPathCtx.supremeObservability;
  invalidObs.recordEvent({ event_id: 'evt-failopen', timestamp: new Date().toISOString(), type: 'test:failopen' });
  invalidObs.flushSync();
  assert(invalidObs.getWriteErrorCount() > 0, 'Writer failure increments error count and fails open without throwing');

  // Clean up
  await fiber.dispose();
  assert(ctx.supremeObservability === undefined, 'Disposal cleanly unregisters supremeObservability');

  if (fs.existsSync(testLogPath)) {
    fs.unlinkSync(testLogPath);
  }

  console.log(`Observability Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-observability.ts')) {
  runObservabilityTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
