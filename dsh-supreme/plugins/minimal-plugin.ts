/**
 * @license
 * Minimal Plugin for Step 0 Loader Verification
 */

import { Context } from 'cordis';

export interface MinimalPluginConfig {
  markerText?: string;
}

export const MinimalPlugin = {
  name: 'minimal-plugin',
  apply(ctx: Context, config: MinimalPluginConfig = {}) {
    const marker = config.markerText || 'DSH_MINIMAL_PLUGIN_READY';
    const rootCtx = ctx.root || ctx;
    (rootCtx as any).__minimal_plugin_marker = marker;
    (rootCtx as any).__minimal_plugin_loaded = true;

    // In Cordis v4, the returned function is registered as the disposal cleanup effect
    return () => {
      (rootCtx as any).__minimal_plugin_disposed = true;
      (rootCtx as any).__minimal_plugin_loaded = false;
    };
  },
};

export default MinimalPlugin;
