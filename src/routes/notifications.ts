import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { getDbContext } from '../db'
import { insertIgnore } from '../db/upsert'
import { requireAuth } from '../middleware/auth'
import { sendNotification } from '../services/notifier'
import { SENSITIVE_FIELDS, isEncryptedValue, encryptField } from '../utils'
import type { Env } from '../index'

const router = new Hono<{ Bindings: Env }>()
router.use('*', requireAuth)

function sanitizeChannel(ch: { id: string; name: string; type: string; config: string; active: boolean; isDefault: boolean; createdAt: number }) {
  const config = JSON.parse(ch.config) as Record<string, string>
  const sensitiveKeys = SENSITIVE_FIELDS[ch.type] ?? []
  const encryptedFields: string[] = []

  for (const key of sensitiveKeys) {
    if (config[key] && isEncryptedValue(config[key])) {
      encryptedFields.push(key)
      config[key] = ''
    }
  }

  return { ...ch, config: JSON.stringify(config), encryptedFields }
}

async function encryptSensitiveFields(
  config: Record<string, string>,
  type: string,
  encryptionKey: string,
): Promise<Record<string, string>> {
  const result = { ...config }
  for (const key of SENSITIVE_FIELDS[type] ?? []) {
    if (result[key] && result[key].length > 0 && !isEncryptedValue(result[key])) {
      result[key] = await encryptField(result[key], encryptionKey)
    }
  }
  return result
}

router.get('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  const channels = await db.select().from(notificationChannels)
  return c.json(channels.map(sanitizeChannel))
})

router.get('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  const ch = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, c.req.param('id')),
  })
  if (!ch) return c.json({ error: 'Not found' }, 404)
  return c.json(sanitizeChannel(ch))
})

router.post('/', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  const body = await c.req.json()
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  let config = body.config ?? {}
  config = await encryptSensitiveFields(config, body.type, c.env.ENCRYPTION_KEY)

  await db.insert(notificationChannels).values({
    id,
    name: body.name,
    type: body.type,
    config: JSON.stringify(config),
    active: body.active ?? true,
    isDefault: body.isDefault ?? false,
    createdAt: now,
  })

  const created = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, id),
  })
  return c.json(sanitizeChannel(created!), 201)
})

router.put('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, id),
  })
  if (!existing) return c.json({ error: 'Not found' }, 404)

  let newConfig: Record<string, string> | undefined
  if (body.config !== undefined) {
    const existingConfig = JSON.parse(existing.config) as Record<string, string>
    const incomingConfig = body.config as Record<string, string>
    const mergedConfig = { ...existingConfig, ...incomingConfig }

    for (const key of SENSITIVE_FIELDS[existing.type] ?? []) {
      const incoming = incomingConfig[key]
      if (!incoming || incoming.length === 0) {
        mergedConfig[key] = existingConfig[key] ?? ''
      } else if (!isEncryptedValue(incoming)) {
        mergedConfig[key] = await encryptField(incoming, c.env.ENCRYPTION_KEY)
      }
    }

    newConfig = mergedConfig
  }

  await db.update(notificationChannels).set({
    name: body.name ?? existing.name,
    type: body.type ?? existing.type,
    config: newConfig !== undefined ? JSON.stringify(newConfig) : existing.config,
    active: body.active ?? existing.active,
    isDefault: body.isDefault !== undefined ? body.isDefault : existing.isDefault,
  }).where(eq(notificationChannels.id, id))

  const updated = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, id),
  })
  return c.json(sanitizeChannel(updated!))
})

router.delete('/:id', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  await db.delete(notificationChannels).where(eq(notificationChannels.id, c.req.param('id')))
  return c.json({ ok: true })
})

router.post('/:id/apply-all-monitors', async (c) => {
  const { db, tables, dialect } = await getDbContext(c.env)
  const { notificationChannels, monitors, monitorNotifications } = tables
  const channelId = c.req.param('id')

  const ch = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, channelId),
  })
  if (!ch) return c.json({ error: 'Not found' }, 404)

  const allMonitors = await db.select().from(monitors)
  for (const monitor of allMonitors) {
    await insertIgnore(
      dialect,
      db.insert(monitorNotifications).values({ monitorId: monitor.id, channelId }),
      { monitorId: sql`monitor_id` },
    )
  }

  return c.json({ ok: true, applied: allMonitors.length })
})

router.post('/:id/test', async (c) => {
  const { db, tables } = await getDbContext(c.env)
  const { notificationChannels } = tables
  const ch = await db.query.notificationChannels.findFirst({
    where: eq(notificationChannels.id, c.req.param('id')),
  })
  if (!ch) return c.json({ error: 'Not found' }, 404)

  try {
    await sendNotification(ch, {
      type: 'callback',
      monitor: { id: 'test', name: 'Test Monitor', type: 'http', url: 'https://example.com' },
      status: 'up',
      message: 'This is a test notification from Pingflare.',
    }, c.env.ENCRYPTION_KEY)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

export default router
