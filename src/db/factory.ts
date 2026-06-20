import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { sql } from 'drizzle-orm'
import type { Env } from '../index'
import type { Db, Tables, Dialect, DbContext } from './index'
import * as sqliteSchema from './schema'
import { ensureSchema as ensureSqliteSchema, SCHEMA_SQL, ALTER_STATEMENTS } from './migrate'
import { PG_DDL, MYSQL_DDL, splitStatements } from './ddl'

const d1Cache = new WeakMap<object, DbContext>()
let externalCtx: DbContext | null = null
let externalCloser: (() => Promise<void>) | null = null

type ExternalKind = 'postgres' | 'mysql' | 'singlestore' | 'libsql' | 'sqlite-file'

function classify(env: Env): { external: false } | { external: true; kind: ExternalKind; url: string } {
  const driver = env.DB_DRIVER?.toLowerCase()
  // Hyperdrive binding carries its own connection string (scheme tells PG vs MySQL).
  const hyperUrl = (env.HYPERDRIVE as { connectionString?: string } | undefined)?.connectionString
  const url = hyperUrl ?? env.DATABASE_URL ?? ''

  if (driver) {
    if (driver === 'postgres' || driver === 'postgresql' || driver === 'supabase') return { external: true, kind: 'postgres', url }
    if (driver === 'mysql' || driver === 'mariadb') return { external: true, kind: 'mysql', url }
    if (driver === 'singlestore') return { external: true, kind: 'singlestore', url }
    if (driver === 'libsql' || driver === 'turso') return { external: true, kind: 'libsql', url }
    if (driver === 'sqlite' || driver === 'file' || driver === 'better-sqlite3') return { external: true, kind: 'sqlite-file', url }
    if (driver === 'd1') return { external: false }
  }

  if (url) {
    const scheme = url.slice(0, url.indexOf(':')).toLowerCase()
    if (scheme === 'postgres' || scheme === 'postgresql') return { external: true, kind: 'postgres', url }
    if (scheme === 'mysql' || scheme === 'mariadb') return { external: true, kind: 'mysql', url }
    if (scheme === 'singlestore') return { external: true, kind: 'singlestore', url }
    if (scheme === 'libsql') return { external: true, kind: 'libsql', url }
    if (scheme === 'http' || scheme === 'https') return { external: true, kind: 'libsql', url }
    if (scheme === 'file' || scheme === 'sqlite') return { external: true, kind: 'sqlite-file', url }
  }

  return { external: false }
}

export async function getDbContext(env: Env): Promise<DbContext> {
  const c = classify(env)

  if (!c.external) {
    if (!env.DB) throw new Error('No database configured: set DATABASE_URL/DB_DRIVER or bind a D1 database (DB).')
    const key = env.DB as unknown as object
    const hit = d1Cache.get(key)
    if (hit) return hit
    await ensureSqliteSchema(env.DB)
    const ctx: DbContext = {
      db: drizzleD1(env.DB, { schema: sqliteSchema }) as unknown as Db,
      tables: sqliteSchema as Tables,
      dialect: 'sqlite',
    }
    d1Cache.set(key, ctx)
    return ctx
  }

  if (externalCtx) return externalCtx
  externalCtx = await buildExternal(c.kind, c.url)
  return externalCtx
}

export function resetExternalContext(): void {
  externalCtx = null
  externalCloser = null
}

export async function closeExternalContext(): Promise<void> {
  const close = externalCloser
  externalCtx = null
  externalCloser = null
  if (close) await close()
}

async function buildExternal(kind: ExternalKind, url: string): Promise<DbContext> {
  switch (kind) {
    case 'postgres': {
      const postgres = (await import('postgres')).default
      const { drizzle } = await import('drizzle-orm/postgres-js')
      const schema = await import('./schema.pg')
      const client = postgres(url, { max: 1, prepare: false })
      const db = drizzle(client, { schema })
      await runDdl((stmt) => db.execute(sql.raw(stmt)), PG_DDL, 'postgres')
      externalCloser = () => client.end()
      return finalize(db, schema, 'pg')
    }
    case 'mysql':
    case 'singlestore': {
      const mysql = await import('mysql2/promise')
      const { drizzle } = await import('drizzle-orm/mysql2')
      const schema = await import('./schema.mysql')
      const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
      const conn = onWorkers
        ? await mysql.createConnection({ uri: url, disableEval: true })
        : await mysql.createConnection(url)
      const db = drizzle(conn, { schema, mode: 'default' })
      await runDdl((stmt) => db.execute(sql.raw(stmt)), MYSQL_DDL, 'mysql')
      externalCloser = () => conn.end()
      return finalize(db, schema, kind === 'singlestore' ? 'singlestore' : 'mysql')
    }
    case 'libsql': {
      const { createClient } = await import('@libsql/client')
      const { drizzle } = await import('drizzle-orm/libsql')
      const authToken = process.env.DATABASE_AUTH_TOKEN
      const client = createClient(authToken ? { url, authToken } : { url })
      await client.executeMultiple(SCHEMA_SQL)
      for (const stmt of ALTER_STATEMENTS) {
        try { await client.execute(stmt) } catch { /* column already exists */ }
      }
      externalCloser = async () => { client.close() }
      const db = drizzle(client, { schema: sqliteSchema })
      return finalize(db, sqliteSchema, 'sqlite')
    }
    case 'sqlite-file': {
      const { openSqlite } = await import('./shim')
      const file = url.replace(/^(file|sqlite):(\/\/)?/, '')
      const { shim } = openSqlite(file || undefined)
      const d1 = shim as unknown as D1Database
      await ensureSqliteSchema(d1)
      return finalize(drizzleD1(d1, { schema: sqliteSchema }), sqliteSchema, 'sqlite')
    }
  }
}

function finalize(db: unknown, schema: unknown, dialect: Dialect): DbContext {
  return { db: db as unknown as Db, tables: schema as Tables, dialect }
}

async function runDdl(
  exec: (stmt: string) => Promise<unknown>,
  ddl: string,
  flavor: 'postgres' | 'mysql',
): Promise<void> {
  for (const stmt of splitStatements(ddl)) {
    const isCreateTable = /^create table/i.test(stmt)
    try {
      await exec(stmt)
    } catch (err) {
      if (isCreateTable) throw err
    }
  }
  const seed = flavor === 'postgres'
    ? `INSERT INTO "settings" ("key","value") VALUES ('retention_days','90') ON CONFLICT DO NOTHING`
    : "INSERT IGNORE INTO `settings` (`key`,`value`) VALUES ('retention_days','90')"
  try { await exec(seed) } catch { /* already seeded */ }
}
