import { Hono } from 'hono'
import { eq, desc, and, gte, count, sql } from 'drizzle-orm'
import { getDbContext } from '../db'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const router = new Hono<{ Bindings: Env }>()
router.use('*', requireAuth)

router.get('/:id/logs', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusLogs } = tables
  const id = c.req.param('id')
  const hoursParam = c.req.query('hours')
  const hours = hoursParam !== undefined ? Number(hoursParam) : null
  const limit = Number(c.req.query('limit') ?? 500)
  const since = hours !== null && hours > 0
    ? Math.floor(Date.now() / 1000) - hours * 3600
    : null

  const rows = await db.select()
    .from(statusLogs)
    .where(since !== null
      ? and(eq(statusLogs.monitorId, id), gte(statusLogs.checkedAt, since))
      : eq(statusLogs.monitorId, id))
    .orderBy(desc(statusLogs.checkedAt))
    .limit(limit)

  return c.json(rows)
})

router.get('/:id/check-count', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusLogs } = tables
  const id = c.req.param('id')
  const [{ total }] = await db.select({ total: count() }).from(statusLogs).where(eq(statusLogs.monitorId, id))
  return c.json({ count: total })
})

router.get('/:id/incidents', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidents } = tables
  const id = c.req.param('id')
  const limit = Number(c.req.query('limit') ?? 50)

  const rows = await db.select()
    .from(incidents)
    .where(eq(incidents.monitorId, id))
    .orderBy(desc(incidents.startedAt))
    .limit(limit)

  return c.json(rows)
})

router.get('/:id/uptime', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusLogs } = tables
  const id = c.req.param('id')
  const days = Number(c.req.query('days') ?? 90)
  const since = Math.floor(Date.now() / 1000) - days * 86400

  const [agg] = await db.select({
    ups: sql<number>`SUM(CASE WHEN ${statusLogs.status} = 'up' THEN 1 ELSE 0 END)`.as('ups'),
    total: count(),
  })
    .from(statusLogs)
    .where(and(eq(statusLogs.monitorId, id), gte(statusLogs.checkedAt, since)))

  if (!agg || !agg.total) return c.json({ uptime: null, days })

  return c.json({ uptime: Math.round((agg.ups / agg.total) * 10000) / 100, days, total: agg.total, up: agg.ups })
})

router.get('/:id/daily', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusLogs, monitors } = tables
  const id = c.req.param('id')
  const days = Number(c.req.query('days') ?? 90)
  const monitor = await db.query.monitors.findFirst({ where: eq(monitors.id, id) })
  if (!monitor) return c.json({ error: 'Not found' }, 404)

  const now = Math.floor(Date.now() / 1000)
  const since = now - days * 86400
  const dayExpr = sql<string>`strftime('%Y-%m-%d', datetime(${statusLogs.checkedAt}, 'unixepoch'))`

  const rows = await db.select({
    day: dayExpr.as('day'),
    ups: sql<number>`SUM(CASE WHEN ${statusLogs.status} = 'up' THEN 1 ELSE 0 END)`.as('ups'),
    total: sql<number>`COUNT(*)`.as('total'),
  })
    .from(statusLogs)
    .where(and(eq(statusLogs.monitorId, id), gte(statusLogs.checkedAt, since)))
    .groupBy(dayExpr)

  const dayMap: Record<string, { ups: number; total: number }> = {}
  for (const row of rows) dayMap[row.day] = { ups: row.ups, total: row.total }

  const result: { date: string; uptime: number | null }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date((now - i * 86400) * 1000).toISOString().slice(0, 10)
    const e = dayMap[d]
    result.push({ date: d, uptime: e ? Math.round((e.ups / e.total) * 1000) / 10 : null })
  }

  return c.json(result)
})

export default router
