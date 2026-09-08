/**
 * Unit Test for @dsh-supreme/router
 */
import { Context } from 'cordis';
import SupremeBenchmarkPlugin from '../../plugins/supreme-benchmark/src/index.ts';
import SupremeObservabilityPlugin from '../../plugins/supreme-observability/src/index.ts';
import SupremePolicyPlugin from '../../plugins/supreme-policy/src/index.ts';
import SupremeRouterPlugin from '../../plugins/supreme-router/src/index.ts';

export async function runRouterTests() {
  console.log('--- RUNNING SUPREME ROUTER TESTS ---');
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
  await ctx.plugin(SupremePolicyPlugin, { executionClass: 'STANDARD', allowPaid: false });
  await ctx.plugin(SupremeObservabilityPlugin, { enabled: false });
  await ctx.plugin(SupremeBenchmarkPlugin, {});
  const routerFiber = await ctx.plugin(SupremeRouterPlugin, { minHistoricalSamples: 3 });

  const router = ctx.supremeRouter;
  assert(!!router, 'supremeRouter service mounted on Context');

  // Register Candidate 1: Free Confirmed, Healthy, High Headroom
  router.registerCandidate({
    provider: 'deepseek',
    model: 'deepseek-chat',
    cost_class: 'FREE_CONFIRMED',
    capabilities: ['tools', 'reasoning', 'code'],
    context_capacity: 64000,
    health_state: 'HEALTHY',
    quota_state: { available_tokens: 1000000, headroom_ratio: 0.9 },
    recent_reliability: 0.98,
    recent_latency_ms: 220,
    failure_domain: 'default',
  });

  // Register Candidate 2: Paid Commercial (Should be rejected by policy)
  router.registerCandidate({
    provider: 'openai',
    model: 'gpt-4o',
    cost_class: 'PAID',
    capabilities: ['tools', 'reasoning', 'code', 'vision'],
    context_capacity: 128000,
    health_state: 'HEALTHY',
    quota_state: { available_tokens: 5000000, headroom_ratio: 1.0 },
    recent_reliability: 0.99,
    recent_latency_ms: 180,
    failure_domain: 'us-east',
  });

  // Register Candidate 3: Free Confirmed, but Small Context Window (Should be rejected for big prompts)
  router.registerCandidate({
    provider: 'local-ollama',
    model: 'qwen-2.5-small',
    cost_class: 'FREE_CONFIRMED',
    capabilities: ['code'],
    context_capacity: 4000,
    health_state: 'HEALTHY',
    quota_state: { available_tokens: 500000, headroom_ratio: 0.8 },
    recent_reliability: 0.95,
    recent_latency_ms: 400,
    failure_domain: 'local',
  });

  // Test 1: Normal route selection (DeepSeek wins, GPT-4o rejected by policy)
  const decision1 = router.selectRoute({
    prompt_tokens: 1000,
    required_capabilities: ['code'],
  });

  assert(decision1.blocked === false, 'Route selection succeeded (not blocked)');
  assert(decision1.provider === 'deepseek' && decision1.model === 'deepseek-chat', 'Best eligible free model deepseek-chat selected');
  assert(decision1.score > 0, `Decision score calculated (${decision1.score})`);

  // Test 2: Context capacity gate
  const decisionBig = router.selectRoute({
    prompt_tokens: 10000,
    required_capabilities: ['code'],
  });
  // local-ollama only has 4000 tokens capacity, so it must not win
  assert(decisionBig.model === 'deepseek-chat', 'Small context model rejected by context capacity gate');

  // Test 3: Circuit breaker gate
  router.tripCircuit('deepseek', 'deepseek-chat', 'CIRCUIT_OPEN');
  const decisionTripped = router.selectRoute({
    prompt_tokens: 1000,
    required_capabilities: ['code'],
  });
  assert(decisionTripped.model === 'qwen-2.5-small', 'Unhealthy model bypassed, fallback to healthy local candidate');

  // Test 4: All eligible routes unavailable -> BLOCKED_NO_ELIGIBLE_ROUTE
  router.tripCircuit('local-ollama', 'qwen-2.5-small', 'PROVIDER_DOWN');
  const decisionBlocked = router.selectRoute({
    prompt_tokens: 1000,
    required_capabilities: ['code'],
  });
  assert(decisionBlocked.blocked === true, 'When all eligible free candidates are down, route is BLOCKED');
  assert(decisionBlocked.reason_codes.includes('BLOCKED_NO_ELIGIBLE_ROUTE'), 'Reason codes contain BLOCKED_NO_ELIGIBLE_ROUTE');
  assert(decisionBlocked.model === null, 'No automatic fallback to paid model was executed');

  // Test 5: Reset circuit
  router.resetCircuit('deepseek', 'deepseek-chat');
  const restoredDecision = router.selectRoute({
    prompt_tokens: 1000,
    required_capabilities: ['code'],
  });
  assert(restoredDecision.blocked === false && restoredDecision.model === 'deepseek-chat', 'Reset circuit restored primary route');

  // Test 6: Disposal
  await routerFiber.dispose();
  assert(ctx.supremeRouter === undefined, 'Disposal cleans up supremeRouter');

  console.log(`Router Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-router.ts')) {
  runRouterTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
