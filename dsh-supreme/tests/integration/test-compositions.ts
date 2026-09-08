/**
 * Integration Test for DSH Supreme Canonical Compositions
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadComposition } from '../../src/loader.ts';

export async function runCompositionTests() {
  console.log('--- RUNNING CANONICAL COMPOSITION TESTS ---');
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

  // Profile 1: core.cordis.yml
  console.log('\n[1] Testing core.cordis.yml');
  const coreRes = await loadComposition('dsh-supreme/config/core.cordis.yml');
  assert(coreRes.mountedPlugins.includes('supreme-policy'), 'core.cordis.yml mounts supreme-policy');
  assert(coreRes.mountedPlugins.length === 1, 'core.cordis.yml contains only supreme-policy');
  assert(!!coreRes.context.supremePolicy, 'supremePolicy is active on Context');
  assert(coreRes.context.supremePolicy.config.executionClass === 'CORE', 'ExecutionClass is CORE');

  // Dispose core
  for (const f of coreRes.fibers) await f.dispose();
  assert(coreRes.context.supremePolicy === undefined, 'core composition disposed cleanly');

  // Profile 2: standard.cordis.yml
  console.log('\n[2] Testing standard.cordis.yml');
  const stdRes = await loadComposition('dsh-supreme/config/standard.cordis.yml');
  assert(stdRes.mountedPlugins.length === 5, 'standard.cordis.yml mounts 5 plugins');
  assert(!!stdRes.context.supremePolicy, 'supremePolicy mounted');
  assert(!!stdRes.context.supremeObservability, 'supremeObservability mounted');
  assert(!!stdRes.context.supremeVerifier, 'supremeVerifier mounted');
  assert(!!stdRes.context.supremeMemoryPolicy, 'supremeMemoryPolicy mounted');
  assert(!!stdRes.context.supremeWorkflowPolicy, 'supremeWorkflowPolicy mounted');

  // Dispose standard
  for (const f of stdRes.fibers) await f.dispose();
  assert(stdRes.context.supremePolicy === undefined, 'standard composition disposed cleanly');

  // Profile 3: supreme.cordis.yml
  console.log('\n[3] Testing supreme.cordis.yml');
  const supRes = await loadComposition('dsh-supreme/config/supreme.cordis.yml');
  assert(supRes.mountedPlugins.length === 7, 'supreme.cordis.yml mounts all 7 plugins');
  assert(!!supRes.context.supremePolicy, 'supremePolicy mounted');
  assert(!!supRes.context.supremeObservability, 'supremeObservability mounted');
  assert(!!supRes.context.supremeBenchmark, 'supremeBenchmark mounted');
  assert(!!supRes.context.supremeRouter, 'supremeRouter mounted');
  assert(!!supRes.context.supremeVerifier, 'supremeVerifier mounted');
  assert(!!supRes.context.supremeMemoryPolicy, 'supremeMemoryPolicy mounted');
  assert(!!supRes.context.supremeWorkflowPolicy, 'supremeWorkflowPolicy mounted');

  // Cross-plugin interaction check: Router uses Policy and Observability
  const route = supRes.context.supremeRouter.selectRoute({ prompt_tokens: 500 });
  assert(route.blocked === true, 'No registered models in clean context returns blocked safely');
  assert(route.reason_codes.includes('BLOCKED_NO_ELIGIBLE_ROUTE'), 'Router executed hard gates with policy');

  // Dispose supreme
  for (const f of supRes.fibers) await f.dispose();
  assert(supRes.context.supremeRouter === undefined, 'supreme composition disposed cleanly');

  // Profile 4: lab.cordis.yml
  console.log('\n[4] Testing lab.cordis.yml');
  const labRes = await loadComposition('dsh-supreme/config/lab.cordis.yml');
  assert(labRes.mountedPlugins.length === 7, 'lab.cordis.yml mounts all 7 plugins');
  assert(labRes.context.supremePolicy.config.executionClass === 'LAB', 'lab execution class is LAB');
  assert(labRes.context.supremePolicy.config.allowPaid === true, 'lab permits paid models under research override');

  // Dispose lab
  for (const f of labRes.fibers) await f.dispose();
  assert(labRes.context.supremePolicy === undefined, 'lab composition disposed cleanly');

  console.log(`\nComposition Tests Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test-compositions.ts')) {
  runCompositionTests().then(({ failed }) => {
    process.exit(failed === 0 ? 0 : 1);
  });
}
