import { defineConfig } from 'tsdown'

/**
 * Host-half build used when no DSH source checkout is available (the official
 * `tsdown.config.ts` needs DSH_CLIENT_BUNDLE_FACTORY for the client bundle).
 * Emits the plain ESM node module the loader imports as `lib/index.js`: only
 * node: builtins stay external.
 *
 * `clean` is off on purpose — the runtime `lib/` directory also holds the
 * separately built `client.js` bundle and the tracked `types/` declarations, so
 * a host rebuild must not wipe them.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'lib',
  platform: 'node',
  target: 'node22',
  dts: false,
  clean: false,
  sourcemap: false,
  treeshake: true,
  // package.json `main` and the loader entry both name `lib/index.js`, so the
  // ESM output must keep the `.js` extension (tsdown defaults ESM to `.mjs`).
  outExtensions: () => ({ js: '.js' }),
})
