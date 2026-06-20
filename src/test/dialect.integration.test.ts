import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDbContext, resetExternalContext, closeExternalContext } from '../db'
import { upsertSetting, insertIgnore } from '../db/upsert'
import { sql } from 'drizzle-orm'
import { JWT_SECRET, ENCRYPTION_KEY, makeAuthHeader } from './setup'
import monitorRoutes from '../routes/monitors'
import settingsRoutes from '../routes/settings'
import type { Env } from '../index'

const DIALECTS: Array<{ name: string; expect: string; url: string | undefined }> = [
  { name: 'postgres', expect: 'pg', url: process.env.TEST_PG_URL },
  { name: 'mysql', expect: 'mysql', url: process.env.TEST_MYSQL_URL },
]

function makeEnv(url: string): Env {
  return {
    ASSETS: undefined as unknown as Fetcher,
    DATABASE_URL: url,
    ADMIN_USER: 'admin',
    ADMIN_PASS: 'testpass',
    JWT_SECRET,
    ENCRYPTION_KEY,
  }
}

for (const d of DIALECTS) {
  describe.skipIf(!d.url)(`dialect: ${d.name}`, () => {
    const env = makeEnv(d.url ?? '')
    let auth: string

    beforeAll(async () => {
      resetExternalContext()
      auth = await makeAuthHeader()
      const { db, tables } = await getDbContext(env)
      await db.delete(tables.monitors)
      await db.delete(tables.notificationChannels)
      await db.delete(tables.statusPages)
      await db.delete(tables.incidentReports)
    })

    afterAll(async () => {
      await closeExternalContext()
    })

    it('reports the expected dialect', async () => {
      const { dialect } = await getDbContext(env)
      expect(dialect).toBe(d.expect)
    })

    it('seeds retention_days via DDL', async () => {
      const { db, tables } = await getDbContext(env)
      const [row] = await db.select().from(tables.settings).where(eq(tables.settings.key, 'retention_days')).limit(1)
      expect(row?.value).toBe('90')
    })

    it('upsertSetting inserts then updates (onConflict/onDuplicate)', async () => {
      const { db, tables, dialect } = await getDbContext(env)
      await upsertSetting(db, dialect, tables, 'locale', 'en')
      let [row] = await db.select().from(tables.settings).where(eq(tables.settings.key, 'locale')).limit(1)
      expect(row?.value).toBe('en')
      await upsertSetting(db, dialect, tables, 'locale', 'pt')
      ;[row] = await db.select().from(tables.settings).where(eq(tables.settings.key, 'locale')).limit(1)
      expect(row?.value).toBe('pt')
    })

    it('inserts a monitor and preserves JS-facing types', async () => {
      const { db, tables } = await getDbContext(env)
      const id = crypto.randomUUID()
      const now = Math.floor(Date.now() / 1000)
      await db.insert(tables.monitors).values({
        id, name: 'M', type: 'http', url: 'https://example.com',
        tags: '[]', headers: '{}', active: true, createdAt: now, updatedAt: now,
      })
      const m = await db.query.monitors.findFirst({ where: eq(tables.monitors.id, id) })
      expect(m).toBeTruthy()
      expect(typeof m!.createdAt).toBe('number')     // bigint mode:number, NOT Date/string
      expect(m!.createdAt).toBe(now)
      expect(m!.active).toBe(true)                   // native boolean
      expect(m!.tags).toBe('[]')                     // json kept as text
      expect(m!.interval).toBe(60)                   // default applied
    })

    it('enforces FK cascade on monitor delete', async () => {
      const { db, tables } = await getDbContext(env)
      const id = crypto.randomUUID()
      const now = Math.floor(Date.now() / 1000)
      await db.insert(tables.monitors).values({
        id, name: 'C', type: 'http', url: 'https://x.test', tags: '[]', headers: '{}', createdAt: now, updatedAt: now,
      })
      await db.insert(tables.statusLogs).values({
        id: crypto.randomUUID(), monitorId: id, status: 'up', checkedAt: now,
      })
      await db.delete(tables.monitors).where(eq(tables.monitors.id, id))
      const logs = await db.select().from(tables.statusLogs).where(eq(tables.statusLogs.monitorId, id))
      expect(logs.length).toBe(0)                     // cascade removed child rows
    })

    it('insertIgnore is idempotent on a composite PK', async () => {
      const { db, tables, dialect } = await getDbContext(env)
      const mId = crypto.randomUUID()
      const cId = crypto.randomUUID()
      const now = Math.floor(Date.now() / 1000)
      await db.insert(tables.monitors).values({
        id: mId, name: 'N', type: 'http', url: 'https://n.test', tags: '[]', headers: '{}', createdAt: now, updatedAt: now,
      })
      await db.insert(tables.notificationChannels).values({
        id: cId, name: 'ch', type: 'webhook', config: '{}', createdAt: now,
      })
      const ins = () => insertIgnore(
        dialect,
        db.insert(tables.monitorNotifications).values({ monitorId: mId, channelId: cId }),
        { monitorId: sql`monitor_id` },
      )
      await ins()
      await ins() // must not throw on duplicate
      const links = await db.select().from(tables.monitorNotifications).where(eq(tables.monitorNotifications.monitorId, mId))
      expect(links.length).toBe(1)
    })

    it('drives the monitors route end-to-end', async () => {
      const app = new Hono()
      app.route('/api/monitors', monitorRoutes)
      app.route('/api/settings', settingsRoutes)

      const createRes = await app.fetch(new Request('http://localhost/api/monitors', {
        method: 'POST',
        headers: { Authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'E2E', type: 'http', url: 'https://e2e.test' }),
      }), env)
      expect(createRes.status).toBe(201)
      const created = await createRes.json() as { id: string; name: string; active: boolean; createdAt: number }
      expect(created.name).toBe('E2E')
      expect(created.active).toBe(true)
      expect(typeof created.createdAt).toBe('number')

      const listRes = await app.fetch(new Request('http://localhost/api/monitors', {
        headers: { Authorization: auth },
      }), env)
      expect(listRes.status).toBe(200)
      const list = await listRes.json() as Array<{ id: string }>
      expect(list.some(m => m.id === created.id)).toBe(true)
    })
  })
}
