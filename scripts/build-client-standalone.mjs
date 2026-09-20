/**
 * Rebuild the plugin's client bundle without a DSH source checkout.
 *
 * The repo's own `pnpm run build` needs `DSH_CLIENT_BUNDLE_FACTORY` pointing at
 * `packages/client/tsdown.client.ts` in the DSH source tree; this machine has
 * no such checkout, so the official client config is replicated here: CJS +
 * browser, react externalised, and the `__ModuleLoader__.load` banner/footer
 * the runtime expects.
 *
 * Usage: node scripts/build-client-standalone.mjs [outDir]   (run from the plugin directory)
 */
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { build } = await import(
  pathToFileURL(resolve(process.cwd(), 'node_modules/tsdown/dist/index.mjs')).href
)
const outDir = process.argv[2] ?? 'lib'
const ID = '@linxin666/dsh-stats-panel'

await build({
  config: false,
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir,
  format: ['cjs'],
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: s => s === 'react' || s === 'react/jsx-runtime',
    alwaysBundle: s => s !== 'react' && s !== 'react/jsx-runtime',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.MODE': '"production"',
    'import.meta.env': '{"MODE":"production"}',
  },
  outputOptions: {
    entryFileNames: 'client.js',
    sourcemapExcludeSources: false,
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
