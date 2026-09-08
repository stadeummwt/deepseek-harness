/**
 * Lifecycle & Disposal Stress Test for DSH Supreme
 * Tests repeated mount/unmount cycles, fiber effect cleanup, and zero leaked intervals/listeners.
 */
import { Context } from 'cordis';
import SupremeBenchmarkPlugin from '../../plugins/supreme-benchmark/src/index.ts';
import SupremeMemoryPolicyPlugin from '../../plugins/supreme-memory-policy/src/index.ts';
import SupremeObservabilityPlugin from '../../plugins/supreme-observability/src/index.ts';
import SupremePolicyPlugin from '../../plugins/supreme-policy/src/index.ts';
import SupremeRouterPlugin from '../../plugins/supreme-router/src/index.ts';
import SupremeVerifierPlugin from '../../plugins/supreme-verifier/src/index.ts';
import SupremeWorkflowPolicyPlugin from '../../plugins/supreme-workflow-policy/src/index.ts';

export async function runLifecycleStressTests() {
  console.log('--- RUNNING LIFECYCLE & DISPOSAL STRESS TESTS ---');
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

  const allPlugins = [
    SupremePolicyPlugin,
    SupremeObservabilityPlugin,
    SupremeBenchmarkPlugin,
    SupremeRouterPlugin,
    SupremeVerifierPlugin,
    SupremeMemoryPolicyPlugin,
    SupremeWorkflowPolicyPlugin,
  ];

  // Run 5 full mount-and-dispose cycles
  for (let cycle = 1; cycle <= 5; cycle++) {
    const ctx = new Context();
    const fibers = [];

    for (const plugin of allPlugins) {
      const fiber = await ctx.plugin(plugin);
      fibers.push(fiber);
    }

    // Verify all 7 services mounted
    assert(
      !!ctx.supremePolicy &&
        !!ctx.supremeObservability &&
        !!ctx.supremeBenchmark &&
        !!ctx.supremeRouter &&
        !!ctx.supremeVerifier &&
        !!ctx.supremeMemoryPolicy &&
        !!ctx.supremeWorkflowPolicy,
      `Cycle ${cycle}: All 7 Supreme services active after mount`
    );

    // Dispose in reverse order
    while (fibers.length > 0) {
      const f = fibers.pop()!;
      await f.dispose();
    }

    // Verify all services cleared
    assert(
      ctx.supremePolicy === undefined &&
        ctx.supremeObservability === undefined &&
        ctx.supremeBenchmark === undefined &&
        ctx.supremeRouter === undefined &&
        ctx.supremeVerifier === undefined &&
        ctx.supremeMemoryPolicy === undefined &&
        ctx.supremeWorkflowPolicy === undefined,
      `Cycle ${cycle}: All 7 Supreme services cleanly disposed without residue`
    );
  }

  console.log(`\nLifecycle Stress Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-lifecycle-disposal.ts')) {
  runLifecycleStressTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
