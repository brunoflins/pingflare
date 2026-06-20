import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { jwtVerify } from 'jose'
import { getDbContext } from '../db'
import type { Env } from '../index'

const router = new Hono<{ Bindings: Env }>()

router.get('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken

  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const key = new TextEncoder().encode(c.env.JWT_SECRET)
    await jwtVerify(token, key)
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const { db: database, tables } = await getDbContext(c.env)
  const { monitors } = tables

  return streamSSE(c, async (stream) => {
    let alive = true
    stream.onAbort(() => { alive = false })

    const snapshot = await database.select().from(monitors)
    await stream.writeSSE({ event: 'snapshot', data: JSON.stringify(snapshot) })

    let ticks = 0
    while (alive) {
      await stream.sleep(30_000)
      if (!alive) break

      ticks++
      await stream.writeSSE({ event: 'heartbeat', data: JSON.stringify({ ts: Date.now() }) })

      if (ticks % 2 === 0) {
        const updated = await database.select().from(monitors)
        await stream.writeSSE({ event: 'snapshot', data: JSON.stringify(updated) })
      }
    }
  })
})

export default router
