/**
 * @license
 * @dsh-supreme/loader
 * Canonical composition profile loader for Cordis v4.
 */

import { Context, Fiber } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';

// Import all 7 Supreme plugins
import SupremeBenchmarkPlugin from '../plugins/supreme-benchmark/src/index.ts';
import SupremeMemoryPolicyPlugin from '../plugins/supreme-memory-policy/src/index.ts';
import SupremeObservabilityPlugin from '../plugins/supreme-observability/src/index.ts';
import SupremePolicyPlugin from '../plugins/supreme-policy/src/index.ts';
import SupremeRouterPlugin from '../plugins/supreme-router/src/index.ts';
import SupremeVerifierPlugin from '../plugins/supreme-verifier/src/index.ts';
import SupremeWorkflowPolicyPlugin from '../plugins/supreme-workflow-policy/src/index.ts';

const PLUGIN_REGISTRY: Record<string, any> = {
  'supreme-policy': SupremePolicyPlugin,
  'supreme-observability': SupremeObservabilityPlugin,
  'supreme-benchmark': SupremeBenchmarkPlugin,
  'supreme-router': SupremeRouterPlugin,
  'supreme-verifier': SupremeVerifierPlugin,
  'supreme-memory-policy': SupremeMemoryPolicyPlugin,
  'supreme-workflow-policy': SupremeWorkflowPolicyPlugin,
};

export interface CompositionLoadResult {
  profilePath: string;
  mountedPlugins: string[];
  fibers: Fiber[];
  context: Context;
}

/**
 * Load a canonical profile from YAML and mount all configured plugins in Cordis v4
 */
export async function loadComposition(
  profilePath: string,
  existingCtx?: Context
): Promise<CompositionLoadResult> {
  const fullPath = path.isAbsolute(profilePath) ? profilePath : path.resolve(process.cwd(), profilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Profile configuration file not found: ${fullPath}`);
  }

  const rawYaml = fs.readFileSync(fullPath, 'utf8');
  const parsed = yaml.parse(rawYaml);

  if (!parsed || typeof parsed !== 'object' || !parsed.plugins) {
    throw new Error(`Invalid composition format in ${profilePath}: 'plugins' section missing`);
  }

  const ctx = existingCtx || new Context();
  const mountedPlugins: string[] = [];
  const fibers: Fiber[] = [];

  // Plugin order: Ensure supreme-policy is always mounted first if present
  const pluginKeys = Object.keys(parsed.plugins);
  if (pluginKeys.includes('supreme-policy')) {
    const idx = pluginKeys.indexOf('supreme-policy');
    pluginKeys.splice(idx, 1);
    pluginKeys.unshift('supreme-policy');
  }

  for (const pluginName of pluginKeys) {
    const pluginClass = PLUGIN_REGISTRY[pluginName];
    if (!pluginClass) {
      throw new Error(`Unrecognized plugin '${pluginName}' specified in composition`);
    }

    const config = parsed.plugins[pluginName] || {};
    const fiber = await ctx.plugin(pluginClass, config);
    fibers.push(fiber);
    mountedPlugins.push(pluginName);
  }

  return {
    profilePath: fullPath,
    mountedPlugins,
    fibers,
    context: ctx,
  };
}
