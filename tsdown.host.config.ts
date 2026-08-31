import { defineConfig } from 'tsdown'

/**
 * Host-half build used when no DSH source checkout is available (the official
 * `tsdown.config.ts` needs DSH_CLIENT_BUNDLE_FACTORY for the client bundle).
 * Emits the same plain ESM node module the loader imports: only node: builtins
 * are external, and lib/client.js is left untouched.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'lib-host-build',
  platform: 'node',
  target: 'node22',
  dts: false,
  clean: true,
  sourcemap: false,
  treeshake: true,
})
