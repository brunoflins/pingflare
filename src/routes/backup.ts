import { Hono } from 'hono'
import {
  getDb,
  monitors,
  notificationChannels,
  statusPages,
  statusPageMonitors,
  monitorNotifications,
  settings,
  heartbeatTokens,
  alertState,
} from '../db'
import { requireAuth } from '../middleware/auth'
import type { Env } from '../index'

const MAX_PAYLOAD_BYTES = 512 * 1024 // 512 KB

const router = new Hono<{ Bindings: Env }>()
router.use('*', requireAuth)

router.get('/', async (c) => {
  const db = getDb(c.env.DB)

  const settingsRows = await db.select().from(settings)
  const settingsMap: Record<string, string> = {}
  for (const row of settingsRows) settingsMap[row.key] = row.value

  const monitorsRows = await db.select().from(monitors)
  const notifRows = await db.select().from(notificationChannels)
  const statusPagesRows = await db.select().from(statusPages)
  const monitorNotifRows = await db.select().from(monitorNotifications)
  const spmRows = await db.select().from(statusPageMonitors)

  const monitorsWithChannels = monitorsRows.map(m => ({
    ...m,
    channelIds: monitorNotifRows.filter(mn => mn.monitorId === m.id).map(mn => mn.channelId),
  }))

  const pagesWithMonitors = statusPagesRows.map(p => ({
    ...p,
    monitorIds: spmRows
      .filter(spm => spm.pageId === p.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(spm => spm.monitorId),
  }))

  return c.json({
    version: 1,
    exportedAt: Math.floor(Date.now() / 1000),
    settings: settingsMap,
    monitors: monitorsWithChannels,
    notifications: notifRows,
    statusPages: pagesWithMonitors,
  })
})

router.post('/restore', async (c) => {
  const contentLength = parseInt(c.req.header('content-length') ?? '0', 10)
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json({ error: `Payload too large (max ${MAX_PAYLOAD_BYTES / 1024}KB)` }, 413)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (body.version !== 1) return c.json({ error: 'Unsupported backup version' }, 400)

  if (body.monitors !== undefined && !Array.isArray(body.monitors))
    return c.json({ error: 'Invalid monitors field' }, 400)
  if (body.notifications !== undefined && !Array.isArray(body.notifications))
    return c.json({ error: 'Invalid notifications field' }, 400)
  if (body.statusPages !== undefined && !Array.isArray(body.statusPages))
    return c.json({ error: 'Invalid statusPages field' }, 400)
  if (body.settings !== undefined && (typeof body.settings !== 'object' || Array.isArray(body.settings)))
    return c.json({ error: 'Invalid settings field' }, 400)

  const db = getDb(c.env.DB)
  const now = Math.floor(Date.now() / 1000)

  await db.delete(monitors)
  await db.delete(notificationChannels)
  await db.delete(statusPages)
  await db.delete(settings)

  const settingsObj = body.settings as Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(settingsObj ?? {})) {
    await db.insert(settings).values({ key, value: String(value) })
  }

  for (const ch of (body.notifications as unknown[] | undefined) ?? []) {
    const c2 = ch as Record<string, unknown>
    await db.insert(notificationChannels).values({
      id: String(c2.id),
      name: String(c2.name),
      type: c2.type as never,
      config: typeof c2.config === 'string' ? c2.config : '{}',
      active: c2.active !== false,
      isDefault: c2.isDefault === true,
      createdAt: typeof c2.createdAt === 'number' ? c2.createdAt : now,
    })
  }

  for (const m of (body.monitors as unknown[] | undefined) ?? []) {
    const mon = m as Record<string, unknown>
    await db.insert(monitors).values({
      id: String(mon.id),
      name: String(mon.name),
      type: mon.type as 'http' | 'heartbeat',
      tags: typeof mon.tags === 'string' ? mon.tags : '[]',
      interval: typeof mon.interval === 'number' ? mon.interval : 60,
      active: mon.active !== false,
      lastCheckedAt: null,
      lastStatus: 'pending',
      reminderIntervalHours: typeof mon.reminderIntervalHours === 'number' ? mon.reminderIntervalHours : null,
      toleranceFailures: typeof mon.toleranceFailures === 'number' ? mon.toleranceFailures : 1,
      url: typeof mon.url === 'string' ? mon.url : null,
      method: typeof mon.method === 'string' ? mon.method : 'GET',
      body: typeof mon.body === 'string' ? mon.body : null,
      headers: typeof mon.headers === 'string' ? mon.headers : '{}',
      expectedStatus: typeof mon.expectedStatus === 'number' ? mon.expectedStatus : 200,
      followRedirects: mon.followRedirects !== false,
      timeout: typeof mon.timeout === 'number' ? mon.timeout : 30,
      ipVersion: (mon.ipVersion as 'auto' | 'ipv4' | 'ipv6') ?? 'auto',
      authType: (mon.authType as 'none' | 'basic' | 'digest' | 'bearer') ?? 'none',
      authUsername: typeof mon.authUsername === 'string' ? mon.authUsername : null,
      authPassword: typeof mon.authPassword === 'string' ? mon.authPassword : null,
      authToken: typeof mon.authToken === 'string' ? mon.authToken : null,
      heartbeatInterval: typeof mon.heartbeatInterval === 'number' ? mon.heartbeatInterval : null,
      heartbeatGrace: typeof mon.heartbeatGrace === 'number' ? mon.heartbeatGrace : 30,
      toleranceMissed: typeof mon.toleranceMissed === 'number' ? mon.toleranceMissed : 1,
      surgeProtectionLimit: typeof mon.surgeProtectionLimit === 'number' ? mon.surgeProtectionLimit : null,
      sslCheckEnabled: mon.sslCheckEnabled === true,
      sslStatus: 'unknown',
      cacheBooster: mon.cacheBooster === true,
      createdAt: typeof mon.createdAt === 'number' ? mon.createdAt : now,
      updatedAt: now,
    })

    await db.insert(alertState).values({ monitorId: String(mon.id) })

    if (mon.type === 'heartbeat') {
      await db.insert(heartbeatTokens).values({ monitorId: String(mon.id), token: crypto.randomUUID() })
    }

    for (const channelId of Array.isArray(mon.channelIds) ? mon.channelIds as string[] : []) {
      await db.insert(monitorNotifications).values({ monitorId: String(mon.id), channelId: String(channelId) })
    }
  }

  for (const p of (body.statusPages as unknown[] | undefined) ?? []) {
    const page = p as Record<string, unknown>
    await db.insert(statusPages).values({
      id: String(page.id),
      name: String(page.name),
      slug: String(page.slug),
      description: typeof page.description === 'string' ? page.description : null,
      passwordHash: typeof page.passwordHash === 'string' ? page.passwordHash : null,
      showAllMonitors: page.showAllMonitors === true,
      createdAt: typeof page.createdAt === 'number' ? page.createdAt : now,
    })

    const monitorIds = Array.isArray(page.monitorIds) ? page.monitorIds as string[] : []
    for (let i = 0; i < monitorIds.length; i++) {
      await db.insert(statusPageMonitors).values({ pageId: String(page.id), monitorId: String(monitorIds[i]), sortOrder: i })
    }
  }

  return c.json({ ok: true })
})

export default router
