/**
 * Master Test Runner for DSH Supreme
 * Runs the entire test matrix (all unit tests, lifecycle tests, security tests, and composition tests).
 * Returns exit code 0 on all pass, exit code 1 on any failure.
 */

import { runMinimalLoaderTests } from './test-step0-minimal.ts';
import { runPolicyTests } from './unit/test-supreme-policy.ts';
import { runObservabilityTests } from './unit/test-supreme-observability.ts';
import { runBenchmarkTests } from './unit/test-supreme-benchmark.ts';
import { runRouterTests } from './unit/test-supreme-router.ts';
import { runVerifierTests } from './unit/test-supreme-verifier.ts';
import { runMemoryPolicyTests } from './unit/test-supreme-memory-policy.ts';
import { runWorkflowPolicyTests } from './unit/test-supreme-workflow-policy.ts';
import { runCompositionTests } from './integration/test-compositions.ts';
import { runLifecycleStressTests } from './integration/test-lifecycle-disposal.ts';
import { runSecurityRedactionTests } from './integration/test-security-redaction.ts';

async function main() {
  console.log('====================================================');
  console.log('       DSH SUPREME MASTER TEST SUITE RUNNER         ');
  console.log('====================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;

  const suites: Array<{ name: string; run: () => Promise<{ passed: number; failed: number }> }> = [
    { name: 'Step 0: Minimal Cordis Loader & Disposal', run: runMinimalLoaderTests },
    { name: 'Plugin 1: supreme-policy Unit Tests', run: runPolicyTests },
    { name: 'Plugin 2: supreme-observability Unit Tests', run: runObservabilityTests },
    { name: 'Plugin 3: supreme-benchmark Unit Tests', run: runBenchmarkTests },
    { name: 'Plugin 4: supreme-router Unit Tests', run: runRouterTests },
    { name: 'Plugin 5: supreme-verifier Unit Tests', run: runVerifierTests },
    { name: 'Plugin 6: supreme-memory-policy Unit Tests', run: runMemoryPolicyTests },
    { name: 'Plugin 7: supreme-workflow-policy Unit Tests', run: runWorkflowPolicyTests },
    { name: 'Integration: Canonical Compositions', run: runCompositionTests },
    { name: 'Integration: Lifecycle & Stress Disposal', run: runLifecycleStressTests },
    { name: 'Integration: Security & Secret Redaction', run: runSecurityRedactionTests },
  ];

  for (const suite of suites) {
    console.log(`>>> RUNNING: ${suite.name}`);
    try {
      const res = await suite.run();
      totalPassed += res.passed;
      totalFailed += res.failed;
    } catch (err: any) {
      console.error(`Suite '${suite.name}' threw an uncaught error:`, err);
      totalFailed++;
    }
    console.log('----------------------------------------------------');
  }

  console.log('\n====================================================');
  console.log(`TOTAL PASSED: ${totalPassed}`);
  console.log(`TOTAL FAILED: ${totalFailed}`);
  console.log('====================================================');

  if (totalFailed > 0) {
    console.error(`\nFAILED: ${totalFailed} tests failed.`);
    process.exit(1);
  } else {
    console.log(`\nSUCCESS: All ${totalPassed} tests passed without error!`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
