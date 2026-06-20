CREATE TABLE "alert_state" (
	"monitor_id" text PRIMARY KEY NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"consecutive_missed" integer DEFAULT 0 NOT NULL,
	"alert_sent_at" bigint,
	"consecutive_alerts" integer DEFAULT 0 NOT NULL,
	"last_reminder_at" bigint,
	"surge_paused_until" bigint
);
--> statement-breakpoint
CREATE TABLE "heartbeat_tokens" (
	"monitor_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"last_ping_at" bigint,
	CONSTRAINT "heartbeat_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "incident_monitors" (
	"incident_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	CONSTRAINT "incident_monitors_incident_id_monitor_id_pk" PRIMARY KEY("incident_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"started_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE "incident_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"incident_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"started_at" bigint NOT NULL,
	"resolved_at" bigint,
	"duration_seconds" integer
);
--> statement-breakpoint
CREATE TABLE "monitor_notifications" (
	"monitor_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "monitor_notifications_monitor_id_channel_id_pk" PRIMARY KEY("monitor_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "monitors" (
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
CREATE TABLE "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"config" text DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT extract(epoch from now())::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_logs" (
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
CREATE TABLE "status_page_monitors" (
	"page_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "status_page_monitors_page_id_monitor_id_pk" PRIMARY KEY("page_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE "status_pages" (
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