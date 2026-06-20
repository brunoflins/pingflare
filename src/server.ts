import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { schedule } from 'node-cron'
import path from 'node:path'

import { openSqlite } from './db/shim'
import { getDbContext } from './db'
import { runCron } from './cron'
import { requireAuth } from './middleware/auth'
import type { Env } from './index'

import authRoutes from './routes/auth'
import monitorRoutes from './routes/monitors'
import heartbeatRoutes from './routes/heartbeat'
import historyRoutes from './routes/history'
import notificationRoutes from './routes/notifications'
import settingsRoutes from './routes/settings'
import statusPagesRoutes from './routes/statusPages'
import publicStatusRoutes from './routes/publicStatus'
import incidentReportsRoutes from './routes/incidentReports'
import backupRoutes from './routes/backup'
import eventsRoutes from './routes/events'

async function main() {
  const env: Env = {
    ASSETS: undefined as unknown as Fetcher, // not used in Node.js path
    DATABASE_URL: process.env.DATABASE_URL,
    DB_DRIVER: process.env.DB_DRIVER,
    ADMIN_USER: process.env.ADMIN_USER ?? '',
    ADMIN_PASS: process.env.ADMIN_PASS ?? '',
    JWT_SECRET: process.env.JWT_SECRET ?? '',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
  }

  if (!env.DATABASE_URL && !env.DB_DRIVER) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'pingflare.db')
    const { shim } = openSqlite(dbPath)
    env.DB = shim as unknown as D1Database
  }

  await getDbContext(env)

  if (!env.ADMIN_USER || !env.ADMIN_PASS || !env.JWT_SECRET || !env.ENCRYPTION_KEY) {
    console.error('Missing required env vars: ADMIN_USER, ADMIN_PASS, JWT_SECRET, ENCRYPTION_KEY')
    process.exit(1)
  }

  const app = new Hono<{ Bindings: Env }>()

  app.use('/api/*', cors())

  app.route('/api/auth', authRoutes)
  app.route('/api/monitors', monitorRoutes)
  app.route('/h', heartbeatRoutes)
  app.route('/api/monitors', historyRoutes)
  app.route('/api/notifications', notificationRoutes)
  app.route('/api/settings', settingsRoutes)
  app.route('/api/status-pages', statusPagesRoutes)
  app.route('/api/public/status', publicStatusRoutes)
  app.route('/api/incidents', incidentReportsRoutes)
  app.route('/api/backup', backupRoutes)
  app.route('/api/events', eventsRoutes)

  app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }))

  app.post('/api/cron/run', requireAuth, async (c) => {
    await runCron(c.env)
    return c.json({ ok: true, triggeredAt: Date.now() })
  })

  const staticRoot = path.join(process.cwd(), 'frontend', 'build')
  app.use('*', serveStatic({ root: staticRoot }))
  app.get('*', serveStatic({ path: path.join(staticRoot, 'index.html') }))

  schedule('* * * * *', () => {
    runCron(env).catch((err) => console.error('[cron]', err))
  })

  const port = parseInt(process.env.PORT ?? '3000', 10)

  serve(
    {
      fetch: (req) => app.fetch(req, env),
      port,
    },
    (info) => console.log(`Pingflare running on http://0.0.0.0:${info.port}`),
  )
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
