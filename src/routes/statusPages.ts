import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDbContext } from '../db'
import { requireAuth } from '../middleware/auth'
import { hashPassword } from '../utils'
import type { Env } from '../index'

const router = new Hono<{ Bindings: Env }>()
router.use('*', requireAuth)

router.get('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPages } = tables
  const rows = await db.select().from(statusPages)
  return c.json(rows)
})

router.post('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPages, statusPageMonitors } = tables
  const body = await c.req.json()
  const id = crypto.randomUUID()

  let passwordHash: string | null = null
  if (body.password) passwordHash = await hashPassword(body.password)

  await db.insert(statusPages).values({
    id,
    name: body.name,
    slug: body.slug,
    description: body.description ?? null,
    passwordHash,
    showAllMonitors: body.showAllMonitors ?? false,
  })

  if (Array.isArray(body.monitorIds)) {
    for (let i = 0; i < body.monitorIds.length; i++) {
      await db.insert(statusPageMonitors).values({ pageId: id, monitorId: body.monitorIds[i], sortOrder: i })
    }
  }

  const created = await db.query.statusPages.findFirst({ where: eq(statusPages.id, id) })
  return c.json(created, 201)
})

router.get('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPages } = tables
  const page = await db.query.statusPages.findFirst({ where: eq(statusPages.id, c.req.param('id')) })
  if (!page) return c.json({ error: 'Not found' }, 404)
  return c.json(page)
})

router.put('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPages, statusPageMonitors } = tables
  const id = c.req.param('id')
  const body = await c.req.json()
  const existing = await db.query.statusPages.findFirst({ where: eq(statusPages.id, id) })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  let passwordHash = existing.passwordHash
  if (body.password === '') {
    passwordHash = null
  } else if (body.password) {
    passwordHash = await hashPassword(body.password)
  }

  await db.update(statusPages).set({
    name: body.name ?? existing.name,
    slug: body.slug ?? existing.slug,
    description: body.description !== undefined ? body.description : existing.description,
    passwordHash,
    showAllMonitors: body.showAllMonitors !== undefined ? body.showAllMonitors : existing.showAllMonitors,
  }).where(eq(statusPages.id, id))

  if (Array.isArray(body.monitorIds)) {
    await db.delete(statusPageMonitors).where(eq(statusPageMonitors.pageId, id))
    for (let i = 0; i < body.monitorIds.length; i++) {
      await db.insert(statusPageMonitors).values({ pageId: id, monitorId: body.monitorIds[i], sortOrder: i })
    }
  }

  const updated = await db.query.statusPages.findFirst({ where: eq(statusPages.id, id) })
  return c.json(updated)
})

router.delete('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPages } = tables
  await db.delete(statusPages).where(eq(statusPages.id, c.req.param('id')))
  return c.json({ ok: true })
})

router.get('/:id/monitors', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { statusPageMonitors } = tables
  const rows = await db.select().from(statusPageMonitors)
    .where(eq(statusPageMonitors.pageId, c.req.param('id')))
  return c.json(rows.map(r => r.monitorId))
})

export default router
