import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = (name) => path.resolve(here, '../../packages', name, 'src');

/* The shared packages are consumed as source, not as built artefacts — one
   less build step, and edits in ui-web hot-reload straight into the console. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wag/ui-web': pkg('ui-web'),
      '@wag/api-client': pkg('api-client')
    }
  },
  server: { port: 5173 }
});
