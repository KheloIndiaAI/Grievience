import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Internal view (`npm run dev:internal`): serves the internal dataset from private/ at
 * /@internal/<file>, on the local dev server only. private/ is git-ignored and is never
 * copied into dist/, so the internal data cannot end up in a build.
 */
function internalData(): Plugin {
  const dir = path.resolve(__dirname, 'private')
  return {
    name: 'internal-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/@internal/', (req, res) => {
        const file = path.join(dir, path.basename(decodeURIComponent((req.url ?? '').split('?')[0])))
        if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) {
          res.statusCode = 404
          res.end(`Internal dataset not found. Put it at private/${path.basename(file)} (see data-pipeline/README.md).`)
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

export default defineConfig(({ command }) => {
  // the public build must always read the redacted file shipped in public/data
  if (command === 'build' && process.env.VITE_DATA_URL) {
    throw new Error('VITE_DATA_URL must not be set for a build: only the redacted public dataset may be built.')
  }
  return {
    plugins: [react(), internalData()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: { port: 5173, open: false },
    build: { chunkSizeWarningLimit: 1500 },
  }
})
