import { Hono } from 'hono'
import { eq, desc, inArray } from 'drizzle-orm'
import { getDbContext } from '../db'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const router = new Hono<{ Bindings: Env }>()
router.use('*', requireAuth)

router.get('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports, incidentMonitors, incidentUpdates } = tables
  const rows = await db.select().from(incidentReports).orderBy(desc(incidentReports.startedAt)).limit(100)
  const enriched = await Promise.all(rows.map(async (inc) => {
    const links = await db.select().from(incidentMonitors).where(eq(incidentMonitors.incidentId, inc.id))
    const updates = await db.select().from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, inc.id))
      .orderBy(desc(incidentUpdates.createdAt))
    return { ...inc, monitorIds: links.map(r => r.monitorId), updates }
  }))
  return c.json(enriched)
})

router.post('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports, incidentUpdates, incidentMonitors } = tables
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  await db.insert(incidentReports).values({
    id,
    title: body.title,
    status: body.status ?? 'investigating',
    startedAt: now,
    resolvedAt: body.status === 'resolved' ? now : null,
  })

  if (body.message) {
    await db.insert(incidentUpdates).values({
      id: crypto.randomUUID(),
      incidentId: id,
      message: body.message,
      status: body.status ?? 'investigating',
    })
  }

  if (Array.isArray(body.monitorIds)) {
    for (const monitorId of body.monitorIds) {
      await db.insert(incidentMonitors).values({ incidentId: id, monitorId })
    }
  }

  const created = await db.query.incidentReports.findFirst({ where: eq(incidentReports.id, id) })
  return c.json(created, 201)
})

router.get('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports, incidentUpdates, incidentMonitors } = tables
  const id = c.req.param('id')
  const incident = await db.query.incidentReports.findFirst({ where: eq(incidentReports.id, id) })
  if (!incident) return c.json({ error: 'Not found' }, 404)
  const updates = await db.select().from(incidentUpdates)
    .where(eq(incidentUpdates.incidentId, id))
    .orderBy(desc(incidentUpdates.createdAt))
  const links = await db.select().from(incidentMonitors).where(eq(incidentMonitors.incidentId, id))
  return c.json({ ...incident, updates, monitorIds: links.map(r => r.monitorId) })
})

router.put('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports, incidentMonitors } = tables
  const id = c.req.param('id')
  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)
  const existing = await db.query.incidentReports.findFirst({ where: eq(incidentReports.id, id) })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const resolvedAt = body.status === 'resolved' && !existing.resolvedAt ? now : existing.resolvedAt
  await db.update(incidentReports).set({
    title: body.title ?? existing.title,
    status: body.status ?? existing.status,
    resolvedAt,
  }).where(eq(incidentReports.id, id))

  if (Array.isArray(body.monitorIds)) {
    await db.delete(incidentMonitors).where(eq(incidentMonitors.incidentId, id))
    for (const monitorId of body.monitorIds) {
      await db.insert(incidentMonitors).values({ incidentId: id, monitorId })
    }
  }

  const updated = await db.query.incidentReports.findFirst({ where: eq(incidentReports.id, id) })
  return c.json(updated)
})

router.post('/:id/updates', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports, incidentUpdates } = tables
  const incidentId = c.req.param('id')
  const body = await c.req.json()
  const now = Math.floor(Date.now() / 1000)

  const incident = await db.query.incidentReports.findFirst({ where: eq(incidentReports.id, incidentId) })
  if (!incident) return c.json({ error: 'Not found' }, 404)

  const updateId = crypto.randomUUID()
  await db.insert(incidentUpdates).values({
    id: updateId,
    incidentId,
    message: body.message,
    status: body.status,
  })

  const resolvedAt = body.status === 'resolved' && !incident.resolvedAt ? now : incident.resolvedAt
  await db.update(incidentReports).set({ status: body.status, resolvedAt }).where(eq(incidentReports.id, incidentId))

  const update = await db.query.incidentUpdates.findFirst({ where: eq(incidentUpdates.id, updateId) })
  return c.json(update, 201)
})

router.delete('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { incidentReports } = tables
  await db.delete(incidentReports).where(eq(incidentReports.id, c.req.param('id')))
  return c.json({ ok: true })
})

export default router
