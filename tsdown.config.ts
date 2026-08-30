import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * The DSH preset lives in the host source workspace and is not an npm export.
 * Require its path explicitly so a public checkout never depends on one
 * developer's filesystem layout.
 */
const configDirectory = fileURLToPath(new URL('.', import.meta.url))
const configuredFactory = process.env['DSH_CLIENT_BUNDLE_FACTORY']?.trim()
if (configuredFactory === undefined || configuredFactory === '') {
  throw new Error('Set DSH_CLIENT_BUNDLE_FACTORY to packages/client/tsdown.client.ts in a DSH source checkout')
}
const factoryUrl = pathToFileURL(resolve(configDirectory, configuredFactory))
const { clientBundle } = await import(factoryUrl.href)

export default clientBundle('@linxin666/dsh-stats-panel', ['src/index.ts'])
