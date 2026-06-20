import { Hono } from 'hono'
import { getDbContext } from '../db'
import { upsertSetting } from '../db/upsert'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

app.use('*', requireAuth)

app.get('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { settings } = tables
  const rows = await db.select().from(settings)
  const result: Record<string, string> = {}
  for (const row of rows) result[row.key] = row.value
  return c.json(result)
})

app.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const { db, tables, dialect } = await getDbContext(c.env)
  const { settings } = tables
  for (const [key, value] of Object.entries(body)) {
    await upsertSetting(db, dialect, tables, key, String(value))
  }
  const rows = await db.select().from(settings)
  const result: Record<string, string> = {}
  for (const row of rows) result[row.key] = row.value
  return c.json(result)
})

export default app
