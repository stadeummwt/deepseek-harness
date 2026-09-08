/**
 * Unit Test for @dsh-supreme/policy
 */
import { Context } from 'cordis';
import SupremePolicyPlugin, { SupremePolicyService } from '../../plugins/supreme-policy/src/index.ts';

export async function runPolicyTests() {
  console.log('--- RUNNING SUPREME POLICY TESTS ---');
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

  // Test 1: Production defaults
  const ctx = new Context();
  const fiber = await ctx.plugin(SupremePolicyPlugin, { executionClass: 'STANDARD' });
  const policy = ctx.supremePolicy;

  assert(!!policy, 'supremePolicy service is registered on Context');

  // 1. FREE_CONFIRMED allowed
  const freeRoute = policy.evaluateRoute({ cost_class: 'FREE_CONFIRMED', provider: 'deepseek', model: 'deepseek-chat' });
  assert(freeRoute.permitted === true, 'FREE_CONFIRMED route is permitted by default');

  // 2. PAID denied
  const paidRoute = policy.evaluateRoute({ cost_class: 'PAID', provider: 'openai', model: 'gpt-4o' });
  assert(paidRoute.permitted === false, 'PAID route is denied by default in production');

  // 3. TRIAL denied
  const trialRoute = policy.evaluateRoute({ cost_class: 'TRIAL', provider: 'anthropic', model: 'claude-3-5' });
  assert(trialRoute.permitted === false, 'TRIAL route is denied by default');

  // 4. UNKNOWN denied (UNKNOWN -> DENY)
  const unknownRoute = policy.evaluateRoute({ cost_class: 'UNKNOWN', provider: 'custom', model: 'mysterious' });
  assert(unknownRoute.permitted === false, 'UNKNOWN cost class is strictly denied');

  // 5. Delegation limit
  const shallowDelegation = policy.evaluateDelegation(1, 'LOW');
  assert(shallowDelegation.permitted === true, 'Delegation at depth 1 is permitted');

  const deepDelegation = policy.evaluateDelegation(3, 'LOW');
  assert(deepDelegation.permitted === false, 'Delegation at max depth 3 is denied');

  // 6. High risk verification requirement
  const highRiskVer = policy.verificationRequirement('HIGH');
  assert(highRiskVer === 'STRICT', 'HIGH risk tasks mandate STRICT verification');

  // 7. LAB overrides
  const labCtx = new Context();
  await labCtx.plugin(SupremePolicyPlugin, { executionClass: 'LAB', allowPaid: true, allowTrial: true });
  const labPolicy = labCtx.supremePolicy;
  const labPaid = labPolicy.evaluateRoute({ cost_class: 'PAID', provider: 'openai', model: 'gpt-4o' });
  assert(labPaid.permitted === true, 'Explicit LAB configuration permits PAID routes in LAB mode');

  // 8. Disposal clean
  await fiber.dispose();
  assert(ctx.supremePolicy === undefined, 'Disposal cleans up service registration');

  console.log(`Policy Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-policy.ts')) {
  runPolicyTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
