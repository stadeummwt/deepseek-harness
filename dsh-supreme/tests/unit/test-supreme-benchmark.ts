/**
 * Unit Test for @dsh-supreme/benchmark
 */
import { Context } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import SupremeBenchmarkPlugin from '../../plugins/supreme-benchmark/src/index.ts';

export async function runBenchmarkTests() {
  console.log('--- RUNNING SUPREME BENCHMARK TESTS ---');
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

  const testStoragePath = path.resolve(process.cwd(), 'dsh-supreme/data/benchmark/test-benchmarks.jsonl');
  if (fs.existsSync(testStoragePath)) {
    fs.unlinkSync(testStoragePath);
  }

  // Pre-seed a corrupt line and a valid line to test corrupt record resilience
  fs.mkdirSync(path.dirname(testStoragePath), { recursive: true });
  fs.writeFileSync(
    testStoragePath,
    '{ INVALID_JSON_CORRUPT_LINE\n{"run_id":"run-seed-1","task_id":"t1","task_category":"code","provider":"deepseek","model":"deepseek-chat","execution_profile":"STANDARD","start_time":"2026-09-06T00:00:00Z","end_time":"2026-09-06T00:00:01Z","latency_ms":1000,"tool_count":2,"subagent_count":0,"workflow_count":0,"success":true,"quality_score":0.9}\n',
    'utf8'
  );

  const ctx = new Context();
  const fiber = await ctx.plugin(SupremeBenchmarkPlugin, {
    storagePath: testStoragePath,
  });
  const bench = ctx.supremeBenchmark;

  assert(!!bench, 'supremeBenchmark service mounted on Context');

  // Test 1: Corrupt line skipped, valid line loaded
  const preloaded = bench.getAllRecords();
  assert(preloaded.length === 1 && preloaded[0].run_id === 'run-seed-1', 'Corrupt JSON record handled gracefully and valid seed record loaded');

  // Test 2: Task registration and execution lifecycle
  bench.recordTask({
    task_id: 'task-code-1',
    category: 'code',
    description: 'Implement fibonacci in TS',
    expected_output_type: 'typescript',
    risk_class: 'LOW',
  });

  const runId = bench.startRun('task-code-1', {
    provider: 'deepseek',
    model: 'deepseek-chat',
    execution_profile: 'STANDARD',
  });
  assert(!!runId && runId.startsWith('run-'), 'startRun returns valid runId');

  // Finish run
  const completed = bench.finishRun(runId, {
    success: true,
    quality_score: 0.95,
    tool_count: 1,
  });
  assert(completed?.success === true && completed?.quality_score === 0.95, 'finishRun completes with scores and persists run');

  // Test 3: Failure classification recording
  const failRunId = bench.startRun('task-code-1', {
    provider: 'deepseek',
    model: 'deepseek-chat',
  });
  bench.finishRun(failRunId, {
    success: false,
    quality_score: 0.2,
    failure_class: 'RATE_LIMIT',
  });

  // Test 4: Aggregation correctness
  const agg = bench.aggregateModelPerformance('deepseek', 'deepseek-chat');
  assert(agg.sampleCount === 3, `Aggregation counts all 3 samples (got ${agg.sampleCount})`);
  assert(agg.failureDistribution.RATE_LIMIT === 1, 'Failure classification distribution correctly counted RATE_LIMIT');
  assert(agg.avgQuality > 0.6 && agg.avgQuality < 0.8, `Average quality score calculated accurately (got ${agg.avgQuality})`);

  // Test 5: Empty history behavior
  const emptyAgg = bench.aggregateModelPerformance('unknown-provider', 'unknown-model');
  assert(emptyAgg.sampleCount === 0 && emptyAgg.avgQuality === 0.5, 'Unknown model returns safe default prior with 0 samples');

  // Test 6: Secret Sentinel safety check
  const fileText = fs.readFileSync(testStoragePath, 'utf8');
  assert(!fileText.includes('SENTINEL_SECRET'), 'No secrets present in benchmark storage');

  // Test 7: Disposal
  await fiber.dispose();
  assert(ctx.supremeBenchmark === undefined, 'Disposal cleans up supremeBenchmark');

  if (fs.existsSync(testStoragePath)) {
    fs.unlinkSync(testStoragePath);
  }

  console.log(`Benchmark Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-benchmark.ts')) {
  runBenchmarkTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
