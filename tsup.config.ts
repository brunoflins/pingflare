import { defineConfig } from 'tsup'
import path from 'node:path'

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist-server',
  external: ['better-sqlite3', 'postgres', 'mysql2', 'mysql2/promise', '@libsql/client'],
  esbuildOptions(options) {
    options.alias = {
      'cloudflare:sockets': path.resolve('src/shims/cloudflare-sockets.ts'),
    }
  },
})
