import { sql } from 'drizzle-orm'
import type { Db, Dialect, Tables } from './index'

function isMysqlLike(dialect: Dialect): boolean {
  return dialect === 'mysql' || dialect === 'singlestore'
}

export async function upsertSetting(
  db: Db,
  dialect: Dialect,
  tables: Tables,
  key: string,
  value: string,
): Promise<void> {
  const { settings } = tables
  const builder = db.insert(settings).values({ key, value })
  if (isMysqlLike(dialect)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (builder as any).onDuplicateKeyUpdate({ set: { value } })
  } else {
    await builder.onConflictDoUpdate({ target: settings.key, set: { value } })
  }
}

export async function insertIgnore(
  dialect: Dialect,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: any,
  mysqlNoopSet: Record<string, unknown>,
): Promise<void> {
  if (isMysqlLike(dialect)) {
    await builder.onDuplicateKeyUpdate({ set: mysqlNoopSet })
  } else {
    await builder.onConflictDoNothing()
  }
}

export { sql }
