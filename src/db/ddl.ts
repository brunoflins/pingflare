export const PG_DDL = `
CREATE TABLE IF NOT EXISTS "alert_state" (
	"monitor_id" text PRIMARY KEY NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"consecutive_missed" integer DEFAULT 0 NOT NULL,
	"alert_sent_at" bigint,
	"consecutive_alerts" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" bigint,
	"surge_paused_until" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heartbeat_tokens" (
	"monitor_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"last_ping_at" bigint,
	CONSTRAINT "heartbeat_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_monitors" (
	"incident_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	CONSTRAINT "incident_monitors_incident_id_monitor_id_pk" PRIMARY KEY("incident_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"started_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incident_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"started_at" bigint NOT NULL,
	"resolved_at" bigint,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitor_notifications" (
	"monitor_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "monitor_notifications_monitor_id_channel_id_pk" PRIMARY KEY("monitor_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"interval" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" bigint,
	"last_status" text DEFAULT 'pending' NOT NULL,
	"reminder_interval_hours" integer,
	"tolerance_failures" integer DEFAULT 1 NOT NULL,
	"url" text,
	"method" text DEFAULT 'GET' NOT NULL,
	"body" text,
	"headers" text DEFAULT '{}' NOT NULL,
	"expected_status" integer DEFAULT 200 NOT NULL,
	"follow_redirects" boolean DEFAULT true NOT NULL,
	"timeout" integer DEFAULT 30 NOT NULL,
	"ip_version" text DEFAULT 'auto' NOT NULL,
	"auth_type" text DEFAULT 'none' NOT NULL,
	"auth_username" text,
	"auth_password" text,
	"auth_token" text,
	"heartbeat_interval" integer,
	"heartbeat_grace" integer DEFAULT 30 NOT NULL,
	"tolerance_missed" integer DEFAULT 1 NOT NULL,
	"surge_protection_limit" integer,
	"ssl_check_enabled" boolean DEFAULT false NOT NULL,
	"ssl_status" text DEFAULT 'unknown' NOT NULL,
	"cache_booster" boolean DEFAULT false NOT NULL,
	"dns_hostname" text,
	"dns_record_type" text DEFAULT 'A',
	"dns_resolver_url" text,
	"dns_expected_ip" text,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"updated_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"response_time_ms" integer,
	"checked_at" bigint NOT NULL,
	"colo" text,
	"country_code" text,
	"origin_ip" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_page_monitors" (
	"page_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "status_page_monitors_page_id_monitor_id_pk" PRIMARY KEY("page_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"password_hash" text,
	"show_all_monitors" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	CONSTRAINT "status_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "alert_state" ADD CONSTRAINT "alert_state_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_tokens" ADD CONSTRAINT "heartbeat_tokens_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_monitors" ADD CONSTRAINT "incident_monitors_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_monitors" ADD CONSTRAINT "incident_monitors_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_incident_id_incident_reports_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_notifications" ADD CONSTRAINT "monitor_notifications_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_notifications" ADD CONSTRAINT "monitor_notifications_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD CONSTRAINT "status_page_monitors_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_monitors_active" ON "monitors" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_sl_monitor_checked" ON "status_logs" USING btree ("monitor_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_sl_checked_at" ON "status_logs" USING btree ("checked_at");
`

export const MYSQL_DDL = `
CREATE TABLE IF NOT EXISTS \`alert_state\` (
	\`monitor_id\` varchar(36) NOT NULL,
	\`consecutive_failures\` int NOT NULL DEFAULT 0,
	\`consecutive_missed\` int NOT NULL DEFAULT 0,
	\`alert_sent_at\` bigint,
	\`consecutive_alerts\` int NOT NULL DEFAULT 0,
	\`last_reminder_at\` bigint,
	\`surge_paused_until\` bigint,
	CONSTRAINT \`alert_state_monitor_id\` PRIMARY KEY(\`monitor_id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`heartbeat_tokens\` (
	\`monitor_id\` varchar(36) NOT NULL,
	\`token\` varchar(64) NOT NULL,
	\`last_ping_at\` bigint,
	CONSTRAINT \`heartbeat_tokens_monitor_id\` PRIMARY KEY(\`monitor_id\`),
	CONSTRAINT \`heartbeat_tokens_token_unique\` UNIQUE(\`token\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`incident_monitors\` (
	\`incident_id\` varchar(36) NOT NULL,
	\`monitor_id\` varchar(36) NOT NULL,
	CONSTRAINT \`incident_monitors_incident_id_monitor_id_pk\` PRIMARY KEY(\`incident_id\`,\`monitor_id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`incident_reports\` (
	\`id\` varchar(36) NOT NULL,
	\`title\` text NOT NULL,
	\`status\` varchar(16) NOT NULL,
	\`started_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	\`resolved_at\` bigint,
	CONSTRAINT \`incident_reports_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`incident_updates\` (
	\`id\` varchar(36) NOT NULL,
	\`incident_id\` varchar(36) NOT NULL,
	\`message\` text NOT NULL,
	\`status\` varchar(16) NOT NULL,
	\`created_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT \`incident_updates_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`incidents\` (
	\`id\` varchar(36) NOT NULL,
	\`monitor_id\` varchar(36) NOT NULL,
	\`started_at\` bigint NOT NULL,
	\`resolved_at\` bigint,
	\`duration_seconds\` int,
	CONSTRAINT \`incidents_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`monitor_notifications\` (
	\`monitor_id\` varchar(36) NOT NULL,
	\`channel_id\` varchar(36) NOT NULL,
	CONSTRAINT \`monitor_notifications_monitor_id_channel_id_pk\` PRIMARY KEY(\`monitor_id\`,\`channel_id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`monitors\` (
	\`id\` varchar(36) NOT NULL,
	\`name\` text NOT NULL,
	\`type\` varchar(16) NOT NULL,
	\`tags\` text NOT NULL,
	\`interval\` int NOT NULL DEFAULT 60,
	\`active\` boolean NOT NULL DEFAULT true,
	\`last_checked_at\` bigint,
	\`last_status\` varchar(16) NOT NULL DEFAULT 'pending',
	\`reminder_interval_hours\` int,
	\`tolerance_failures\` int NOT NULL DEFAULT 1,
	\`url\` text,
	\`method\` varchar(16) NOT NULL DEFAULT 'GET',
	\`body\` text,
	\`headers\` text NOT NULL,
	\`expected_status\` int NOT NULL DEFAULT 200,
	\`follow_redirects\` boolean NOT NULL DEFAULT true,
	\`timeout\` int NOT NULL DEFAULT 30,
	\`ip_version\` varchar(8) NOT NULL DEFAULT 'auto',
	\`auth_type\` varchar(16) NOT NULL DEFAULT 'none',
	\`auth_username\` text,
	\`auth_password\` text,
	\`auth_token\` text,
	\`heartbeat_interval\` int,
	\`heartbeat_grace\` int NOT NULL DEFAULT 30,
	\`tolerance_missed\` int NOT NULL DEFAULT 1,
	\`surge_protection_limit\` int,
	\`ssl_check_enabled\` boolean NOT NULL DEFAULT false,
	\`ssl_status\` varchar(16) NOT NULL DEFAULT 'unknown',
	\`cache_booster\` boolean NOT NULL DEFAULT false,
	\`dns_hostname\` text,
	\`dns_record_type\` varchar(8) DEFAULT 'A',
	\`dns_resolver_url\` text,
	\`dns_expected_ip\` text,
	\`created_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	\`updated_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT \`monitors_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`notification_channels\` (
	\`id\` varchar(36) NOT NULL,
	\`name\` text NOT NULL,
	\`type\` varchar(16) NOT NULL,
	\`config\` text NOT NULL,
	\`active\` boolean NOT NULL DEFAULT true,
	\`is_default\` boolean NOT NULL DEFAULT false,
	\`created_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT \`notification_channels_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`settings\` (
	\`key\` varchar(191) NOT NULL,
	\`value\` text NOT NULL,
	CONSTRAINT \`settings_key\` PRIMARY KEY(\`key\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`status_logs\` (
	\`id\` varchar(36) NOT NULL,
	\`monitor_id\` varchar(36) NOT NULL,
	\`status\` varchar(16) NOT NULL,
	\`message\` text,
	\`response_time_ms\` int,
	\`checked_at\` bigint NOT NULL,
	\`colo\` text,
	\`country_code\` text,
	\`origin_ip\` text,
	CONSTRAINT \`status_logs_id\` PRIMARY KEY(\`id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`status_page_monitors\` (
	\`page_id\` varchar(36) NOT NULL,
	\`monitor_id\` varchar(36) NOT NULL,
	\`sort_order\` int NOT NULL DEFAULT 0,
	CONSTRAINT \`status_page_monitors_page_id_monitor_id_pk\` PRIMARY KEY(\`page_id\`,\`monitor_id\`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS \`status_pages\` (
	\`id\` varchar(36) NOT NULL,
	\`name\` text NOT NULL,
	\`slug\` varchar(191) NOT NULL,
	\`description\` text,
	\`password_hash\` text,
	\`show_all_monitors\` boolean NOT NULL DEFAULT false,
	\`created_at\` bigint NOT NULL DEFAULT (unix_timestamp()),
	CONSTRAINT \`status_pages_id\` PRIMARY KEY(\`id\`),
	CONSTRAINT \`status_pages_slug_unique\` UNIQUE(\`slug\`)
);
--> statement-breakpoint
ALTER TABLE \`alert_state\` ADD CONSTRAINT \`alert_state_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`heartbeat_tokens\` ADD CONSTRAINT \`heartbeat_tokens_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`incident_monitors\` ADD CONSTRAINT \`incident_monitors_incident_id_incident_reports_id_fk\` FOREIGN KEY (\`incident_id\`) REFERENCES \`incident_reports\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`incident_monitors\` ADD CONSTRAINT \`incident_monitors_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`incident_updates\` ADD CONSTRAINT \`incident_updates_incident_id_incident_reports_id_fk\` FOREIGN KEY (\`incident_id\`) REFERENCES \`incident_reports\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`incidents\` ADD CONSTRAINT \`incidents_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`monitor_notifications\` ADD CONSTRAINT \`monitor_notifications_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`monitor_notifications\` ADD CONSTRAINT \`monitor_notifications_channel_id_notification_channels_id_fk\` FOREIGN KEY (\`channel_id\`) REFERENCES \`notification_channels\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`status_logs\` ADD CONSTRAINT \`status_logs_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`status_page_monitors\` ADD CONSTRAINT \`status_page_monitors_page_id_status_pages_id_fk\` FOREIGN KEY (\`page_id\`) REFERENCES \`status_pages\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE \`status_page_monitors\` ADD CONSTRAINT \`status_page_monitors_monitor_id_monitors_id_fk\` FOREIGN KEY (\`monitor_id\`) REFERENCES \`monitors\`(\`id\`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX \`idx_monitors_active\` ON \`monitors\` (\`active\`);--> statement-breakpoint
CREATE INDEX \`idx_sl_monitor_checked\` ON \`status_logs\` (\`monitor_id\`,\`checked_at\`);--> statement-breakpoint
CREATE INDEX \`idx_sl_checked_at\` ON \`status_logs\` (\`checked_at\`);
`

/** Split embedded DDL into individual statements (drizzle's breakpoint marker). */
export function splitStatements(ddl: string): string[] {
  return ddl
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
