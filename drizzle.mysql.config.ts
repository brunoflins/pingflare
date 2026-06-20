import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.mysql.ts',
  out: './drizzle/mysql',
  dialect: 'mysql',
} satisfies Config
