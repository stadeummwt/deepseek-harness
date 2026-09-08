/**
 * Unit Test for @dsh-supreme/workflow-policy
 */
import { Context } from 'cordis';
import SupremePolicyPlugin from '../../plugins/supreme-policy/src/index.ts';
import SupremeWorkflowPolicyPlugin from '../../plugins/supreme-workflow-policy/src/index.ts';

export async function runWorkflowPolicyTests() {
  console.log('--- RUNNING SUPREME WORKFLOW POLICY TESTS ---');
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
  await ctx.plugin(SupremePolicyPlugin, { executionClass: 'STANDARD', maxDelegationDepth: 3 });
  const fiber = await ctx.plugin(SupremeWorkflowPolicyPlugin, {
    defaultMaxDepth: 3,
    defaultMaxSteps: 5,
    loopThreshold: 3,
  });

  const wfPolicy = ctx.supremeWorkflowPolicy;
  assert(!!wfPolicy, 'supremeWorkflowPolicy service mounted on Context');

  // Test 1: Start valid workflow
  const startRes = wfPolicy.startWorkflow({
    name: 'data-pipeline',
    depth: 1,
    max_steps: 4,
  });
  assert(startRes.allowed === true && !!startRes.workflow_id, 'Valid workflow initiated');

  const wfId = startRes.workflow_id;

  // Test 2: Step counting and progression
  const step1 = wfPolicy.recordStep(wfId, 'fetch_data', { id: 10 });
  const step2 = wfPolicy.recordStep(wfId, 'process_data', { id: 10 });
  assert(step1.allowed && step2.allowed, 'Steps executed normally within budget');

  // Test 3: Loop Detection
  // Re-run identical step 'fetch_data' with same payload 3 times to trigger loop detection
  wfPolicy.recordStep(wfId, 'fetch_data', { id: 10 });
  const stepLoop = wfPolicy.recordStep(wfId, 'fetch_data', { id: 10 });
  assert(stepLoop.allowed === false && stepLoop.status === 'LOOP_DETECTED', 'Loop detector successfully tripped on 3 identical step signatures');

  // Test 4: Max steps limit
  const wfBudget = wfPolicy.startWorkflow({ name: 'tight-budget', depth: 1, max_steps: 2 });
  wfPolicy.recordStep(wfBudget.workflow_id, 's1', { x: 1 });
  wfPolicy.recordStep(wfBudget.workflow_id, 's2', { x: 2 });
  const stepExceeded = wfPolicy.recordStep(wfBudget.workflow_id, 's3', { x: 3 });
  assert(stepExceeded.allowed === false && stepExceeded.status === 'MAX_STEPS_EXCEEDED', 'Step budget limit enforced');

  // Test 5: Checkpoint halts execution on failure
  const wfCheck = wfPolicy.startWorkflow({ name: 'checkpoint-test', depth: 1 });
  const cpPass = wfPolicy.recordCheckpoint(wfCheck.workflow_id, 'compile_check', true);
  assert(cpPass.ok === true && cpPass.status === 'RUNNING', 'Successful checkpoint maintains RUNNING status');

  const cpFail = wfPolicy.recordCheckpoint(wfCheck.workflow_id, 'lint_check', false, 'Found 2 fatal lint errors');
  assert(cpFail.ok === false && cpFail.status === 'VERIFICATION_FAILED', 'Failed checkpoint halts workflow status to VERIFICATION_FAILED');

  const stepAfterFail = wfPolicy.recordStep(wfCheck.workflow_id, 'deploy', {});
  assert(stepAfterFail.allowed === false, 'Subsequent steps are blocked after verification failure');

  // Test 6: Safe cancellation
  const wfCancel = wfPolicy.startWorkflow({ name: 'to-cancel', depth: 1 });
  wfPolicy.cancelWorkflow(wfCancel.workflow_id, 'User terminated');
  const canceledWf = wfPolicy.getWorkflow(wfCancel.workflow_id);
  assert(canceledWf?.status === 'CANCELLED', 'Workflow marked CANCELLED upon cancellation');

  // Test 7: Disposal
  await fiber.dispose();
  assert(ctx.supremeWorkflowPolicy === undefined, 'Disposal cleans up supremeWorkflowPolicy');

  console.log(`Workflow Policy Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-supreme-workflow-policy.ts')) {
  runWorkflowPolicyTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
