/**
 * Step 0: Minimal Plugin and Loader verification test
 */
import { Context } from 'cordis';
import MinimalPlugin from '../plugins/minimal-plugin.ts';

export async function runMinimalLoaderTests(): Promise<{ passed: number; failed: number }> {
  const res = await runStep0Test();
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  assert(res.MINIMAL_PLUGIN_LOAD, 'Minimal plugin load confirmed');
  assert(res.CORDIS_COMPOSITION, 'Cordis composition verified');
  assert(res.MINIMAL_PLUGIN_DISPOSE, 'Minimal plugin disposal confirmed');

  return { passed, failed };
}

export async function runStep0Test(): Promise<{
  MINIMAL_PLUGIN_LOAD: boolean;
  MINIMAL_PLUGIN_DISPOSE: boolean;
  CORDIS_COMPOSITION: boolean;
  error?: string;
}> {
  try {
    const ctx = new Context();
    let loadedMarker = '';

    // Test load
    const fiber = await ctx.plugin(MinimalPlugin, { markerText: 'DSH_SUPREME_STARTUP_CONFIRMED' });
    loadedMarker = (ctx as any).__minimal_plugin_marker;
    const loadPass = loadedMarker === 'DSH_SUPREME_STARTUP_CONFIRMED' && (ctx as any).__minimal_plugin_loaded === true;

    // Test Cordis composition
    const compositionPass = fiber && fiber.runtime && typeof fiber.dispose === 'function';

    // Test dispose
    await fiber.dispose();
    const disposePass = (ctx as any).__minimal_plugin_disposed === true || fiber.uid === null;

    return {
      MINIMAL_PLUGIN_LOAD: !!loadPass,
      MINIMAL_PLUGIN_DISPOSE: !!disposePass,
      CORDIS_COMPOSITION: !!compositionPass,
    };
  } catch (err: any) {
    return {
      MINIMAL_PLUGIN_LOAD: false,
      MINIMAL_PLUGIN_DISPOSE: false,
      CORDIS_COMPOSITION: false,
      error: err.message,
    };
  }
}

if (process.argv[1]?.endsWith('test-step0-minimal.ts')) {
  runStep0Test().then((res) => {
    console.log('MINIMAL_PLUGIN_LOAD =', res.MINIMAL_PLUGIN_LOAD ? 'PASS' : 'FAIL');
    console.log('MINIMAL_PLUGIN_DISPOSE =', res.MINIMAL_PLUGIN_DISPOSE ? 'PASS' : 'FAIL');
    console.log('CORDIS_COMPOSITION =', res.CORDIS_COMPOSITION ? 'PASS' : 'FAIL');
    if (res.error) console.error('Error:', res.error);
    process.exit(res.MINIMAL_PLUGIN_LOAD && res.MINIMAL_PLUGIN_DISPOSE && res.CORDIS_COMPOSITION ? 0 : 1);
  });
}
