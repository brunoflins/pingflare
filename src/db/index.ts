import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof getDb>

export type Tables = typeof schema

export type Dialect = 'sqlite' | 'pg' | 'mysql' | 'singlestore'

export type DbContext = {
  db: Db
  tables: Tables
  dialect: Dialect
}

export { getDbContext, resetExternalContext, closeExternalContext } from './factory'

export * from './schema'
