import { mysqlTable, varchar, text, bigint, boolean, int, primaryKey, index } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

const ID = 36
const epochNow = sql`(unix_timestamp())`

export const monitors = mysqlTable('monitors', {
  id: varchar('id', { length: ID }).primaryKey(),
  name: text('name').notNull(),
  type: varchar('type', { length: 16 }).notNull().$type<'http' | 'heartbeat' | 'dns' | 'ping'>(),
  tags: text('tags').notNull(),
  interval: int('interval').notNull().default(60),
  active: boolean('active').notNull().default(true),
  lastCheckedAt: bigint('last_checked_at', { mode: 'number' }),
  lastStatus: varchar('last_status', { length: 16 }).notNull().default('pending').$type<'up' | 'down' | 'pending'>(),
  reminderIntervalHours: int('reminder_interval_hours'),
  toleranceFailures: int('tolerance_failures').notNull().default(1),
  url: text('url'),
  method: varchar('method', { length: 16 }).notNull().default('GET'),
  body: text('body'),
  headers: text('headers').notNull(),
  expectedStatus: int('expected_status').notNull().default(200),
  followRedirects: boolean('follow_redirects').notNull().default(true),
  timeout: int('timeout').notNull().default(30),
  ipVersion: varchar('ip_version', { length: 8 }).notNull().default('auto').$type<'auto' | 'ipv4' | 'ipv6'>(),
  authType: varchar('auth_type', { length: 16 }).notNull().default('none').$type<'none' | 'basic' | 'digest' | 'bearer'>(),
  authUsername: text('auth_username'),
  authPassword: text('auth_password'),
  authToken: text('auth_token'),
  heartbeatInterval: int('heartbeat_interval'),
  heartbeatGrace: int('heartbeat_grace').notNull().default(30),
  toleranceMissed: int('tolerance_missed').notNull().default(1),
  surgeProtectionLimit: int('surge_protection_limit'),
  sslCheckEnabled: boolean('ssl_check_enabled').notNull().default(false),
  sslStatus: varchar('ssl_status', { length: 16 }).notNull().default('unknown').$type<'ok' | 'error' | 'unknown'>(),
  cacheBooster: boolean('cache_booster').notNull().default(false),
  dnsHostname: text('dns_hostname'),
  dnsRecordType: varchar('dns_record_type', { length: 8 }).default('A'),
  dnsResolverUrl: text('dns_resolver_url'),
  dnsExpectedIp: text('dns_expected_ip'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().default(epochNow),
}, (t) => [
  index('idx_monitors_active').on(t.active),
])

export const statusLogs = mysqlTable('status_logs', {
  id: varchar('id', { length: ID }).primaryKey(),
  monitorId: varchar('monitor_id', { length: ID }).notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).notNull().$type<'up' | 'down' | 'pending'>(),
  message: text('message'),
  responseTimeMs: int('response_time_ms'),
  checkedAt: bigint('checked_at', { mode: 'number' }).notNull(),
  colo: text('colo'),
  countryCode: text('country_code'),
  originIp: text('origin_ip'),
}, (t) => [
  index('idx_sl_monitor_checked').on(t.monitorId, t.checkedAt),
  index('idx_sl_checked_at').on(t.checkedAt),
])

export const incidents = mysqlTable('incidents', {
  id: varchar('id', { length: ID }).primaryKey(),
  monitorId: varchar('monitor_id', { length: ID }).notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  startedAt: bigint('started_at', { mode: 'number' }).notNull(),
  resolvedAt: bigint('resolved_at', { mode: 'number' }),
  durationSeconds: int('duration_seconds'),
})

export const notificationChannels = mysqlTable('notification_channels', {
  id: varchar('id', { length: ID }).primaryKey(),
  name: text('name').notNull(),
  type: varchar('type', { length: 16 }).notNull().$type<'discord' | 'slack' | 'telegram' | 'email' | 'ntfy' | 'pushover' | 'webhook' | 'apprise' | 'googlechat'>(),
  config: text('config').notNull(),
  active: boolean('active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const monitorNotifications = mysqlTable('monitor_notifications', {
  monitorId: varchar('monitor_id', { length: ID }).notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  channelId: varchar('channel_id', { length: ID }).notNull().references(() => notificationChannels.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.monitorId, t.channelId] })])

export const heartbeatTokens = mysqlTable('heartbeat_tokens', {
  monitorId: varchar('monitor_id', { length: ID }).primaryKey().references(() => monitors.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  lastPingAt: bigint('last_ping_at', { mode: 'number' }),
})

export const alertState = mysqlTable('alert_state', {
  monitorId: varchar('monitor_id', { length: ID }).primaryKey().references(() => monitors.id, { onDelete: 'cascade' }),
  consecutiveFailures: int('consecutive_failures').notNull().default(0),
  consecutiveMissed: int('consecutive_missed').notNull().default(0),
  alertSentAt: bigint('alert_sent_at', { mode: 'number' }),
  consecutiveAlerts: int('consecutive_alerts').notNull().default(0),
  lastReminderAt: bigint('last_reminder_at', { mode: 'number' }),
  surgePausedUntil: bigint('surge_paused_until', { mode: 'number' }),
})

export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 191 }).primaryKey(),
  value: text('value').notNull(),
})

export const statusPages = mysqlTable('status_pages', {
  id: varchar('id', { length: ID }).primaryKey(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 191 }).notNull().unique(),
  description: text('description'),
  passwordHash: text('password_hash'),
  showAllMonitors: boolean('show_all_monitors').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const statusPageMonitors = mysqlTable('status_page_monitors', {
  pageId: varchar('page_id', { length: ID }).notNull().references(() => statusPages.id, { onDelete: 'cascade' }),
  monitorId: varchar('monitor_id', { length: ID }).notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  sortOrder: int('sort_order').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.pageId, t.monitorId] })])

export const incidentReports = mysqlTable('incident_reports', {
  id: varchar('id', { length: ID }).primaryKey(),
  title: text('title').notNull(),
  status: varchar('status', { length: 16 }).notNull().$type<'investigating' | 'identified' | 'monitoring' | 'resolved'>(),
  startedAt: bigint('started_at', { mode: 'number' }).notNull().default(epochNow),
  resolvedAt: bigint('resolved_at', { mode: 'number' }),
})

export const incidentUpdates = mysqlTable('incident_updates', {
  id: varchar('id', { length: ID }).primaryKey(),
  incidentId: varchar('incident_id', { length: ID }).notNull().references(() => incidentReports.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  status: varchar('status', { length: 16 }).notNull().$type<'investigating' | 'identified' | 'monitoring' | 'resolved'>(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const incidentMonitors = mysqlTable('incident_monitors', {
  incidentId: varchar('incident_id', { length: ID }).notNull().references(() => incidentReports.id, { onDelete: 'cascade' }),
  monitorId: varchar('monitor_id', { length: ID }).notNull().references(() => monitors.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.incidentId, t.monitorId] })])
