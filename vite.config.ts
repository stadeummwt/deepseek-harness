import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function providerHealthProbePlugin(): Plugin {
  return {
    name: 'provider-health-probe-plugin',
    configureServer(server) {
      server.middlewares.use('/api/health/probe', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost:3000');
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing target url parameter' }));
            return;
          }

          const startTime = performance.now();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          let statusCode = 0;
          let statusText = 'Network Error';
          let reachable = false;
          let errorMessage: string | undefined;

          try {
            const fetchResponse = await fetch(targetUrl, {
              method: 'GET',
              headers: {
                'User-Agent': 'DSH-Supreme-Health-Monitor/1.0',
                'Accept': 'application/json, text/plain, */*',
              },
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            statusCode = fetchResponse.status;
            statusText = fetchResponse.statusText;
            reachable = true;
          } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
              statusCode = 504;
              statusText = 'Gateway Timeout';
              errorMessage = 'Probe timed out after 3000ms';
            } else {
              statusCode = 503;
              statusText = 'Service Unreachable';
              errorMessage = err.message || 'Connection refused or host unreachable';
            }
          }

          const latencyMs = Math.max(1, Math.round(performance.now() - startTime));

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              url: targetUrl,
              statusCode,
              statusText,
              latencyMs,
              reachable,
              error: errorMessage,
              timestamp: new Date().toISOString(),
            })
          );
        } catch (globalErr: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: globalErr.message }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), providerHealthProbePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
