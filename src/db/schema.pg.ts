import { pgTable, text, bigint, boolean, integer, primaryKey, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const epochNow = sql`extract(epoch from now())::bigint`

export const monitors = pgTable('monitors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<'http' | 'heartbeat' | 'dns' | 'ping'>(),
  tags: text('tags').notNull().default('[]'),
  interval: integer('interval').notNull().default(60),
  active: boolean('active').notNull().default(true),
  lastCheckedAt: bigint('last_checked_at', { mode: 'number' }),
  lastStatus: text('last_status').notNull().default('pending').$type<'up' | 'down' | 'pending'>(),
  reminderIntervalHours: integer('reminder_interval_hours'),
  toleranceFailures: integer('tolerance_failures').notNull().default(1),
  url: text('url'),
  method: text('method').notNull().default('GET'),
  body: text('body'),
  headers: text('headers').notNull().default('{}'),
  expectedStatus: integer('expected_status').notNull().default(200),
  followRedirects: boolean('follow_redirects').notNull().default(true),
  timeout: integer('timeout').notNull().default(30),
  ipVersion: text('ip_version').notNull().default('auto').$type<'auto' | 'ipv4' | 'ipv6'>(),
  authType: text('auth_type').notNull().default('none').$type<'none' | 'basic' | 'digest' | 'bearer'>(),
  authUsername: text('auth_username'),
  authPassword: text('auth_password'),
  authToken: text('auth_token'),
  heartbeatInterval: integer('heartbeat_interval'),
  heartbeatGrace: integer('heartbeat_grace').notNull().default(30),
  toleranceMissed: integer('tolerance_missed').notNull().default(1),
  surgeProtectionLimit: integer('surge_protection_limit'),
  sslCheckEnabled: boolean('ssl_check_enabled').notNull().default(false),
  sslStatus: text('ssl_status').notNull().default('unknown').$type<'ok' | 'error' | 'unknown'>(),
  cacheBooster: boolean('cache_booster').notNull().default(false),
  dnsHostname: text('dns_hostname'),
  dnsRecordType: text('dns_record_type').default('A'),
  dnsResolverUrl: text('dns_resolver_url'),
  dnsExpectedIp: text('dns_expected_ip'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().default(epochNow),
}, (t) => [
  index('idx_monitors_active').on(t.active),
])

export const statusLogs = pgTable('status_logs', {
  id: text('id').primaryKey(),
  monitorId: text('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  status: text('status').notNull().$type<'up' | 'down' | 'pending'>(),
  message: text('message'),
  responseTimeMs: integer('response_time_ms'),
  checkedAt: bigint('checked_at', { mode: 'number' }).notNull(),
  colo: text('colo'),
  countryCode: text('country_code'),
  originIp: text('origin_ip'),
}, (t) => [
  index('idx_sl_monitor_checked').on(t.monitorId, t.checkedAt),
  index('idx_sl_checked_at').on(t.checkedAt),
])

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  monitorId: text('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  startedAt: bigint('started_at', { mode: 'number' }).notNull(),
  resolvedAt: bigint('resolved_at', { mode: 'number' }),
  durationSeconds: integer('duration_seconds'),
})

export const notificationChannels = pgTable('notification_channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().$type<'discord' | 'slack' | 'telegram' | 'email' | 'ntfy' | 'pushover' | 'webhook' | 'apprise' | 'googlechat'>(),
  config: text('config').notNull().default('{}'),
  active: boolean('active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const monitorNotifications = pgTable('monitor_notifications', {
  monitorId: text('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => notificationChannels.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.monitorId, t.channelId] })])

export const heartbeatTokens = pgTable('heartbeat_tokens', {
  monitorId: text('monitor_id').primaryKey().references(() => monitors.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  lastPingAt: bigint('last_ping_at', { mode: 'number' }),
})

export const alertState = pgTable('alert_state', {
  monitorId: text('monitor_id').primaryKey().references(() => monitors.id, { onDelete: 'cascade' }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  consecutiveMissed: integer('consecutive_missed').notNull().default(0),
  alertSentAt: bigint('alert_sent_at', { mode: 'number' }),
  consecutiveAlerts: integer('consecutive_alerts').notNull().default(0),
  lastReminderAt: bigint('last_reminder_at', { mode: 'number' }),
  surgePausedUntil: bigint('surge_paused_until', { mode: 'number' }),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const statusPages = pgTable('status_pages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  passwordHash: text('password_hash'),
  showAllMonitors: boolean('show_all_monitors').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const statusPageMonitors = pgTable('status_page_monitors', {
  pageId: text('page_id').notNull().references(() => statusPages.id, { onDelete: 'cascade' }),
  monitorId: text('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.pageId, t.monitorId] })])

export const incidentReports = pgTable('incident_reports', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status').notNull().$type<'investigating' | 'identified' | 'monitoring' | 'resolved'>(),
  startedAt: bigint('started_at', { mode: 'number' }).notNull().default(epochNow),
  resolvedAt: bigint('resolved_at', { mode: 'number' }),
})

export const incidentUpdates = pgTable('incident_updates', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull().references(() => incidentReports.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  status: text('status').notNull().$type<'investigating' | 'identified' | 'monitoring' | 'resolved'>(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().default(epochNow),
})

export const incidentMonitors = pgTable('incident_monitors', {
  incidentId: text('incident_id').notNull().references(() => incidentReports.id, { onDelete: 'cascade' }),
  monitorId: text('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.incidentId, t.monitorId] })])
