CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_search_id" uuid NOT NULL,
	"vacancy_count" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"include_private" boolean DEFAULT false NOT NULL,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"schedule_cron" text,
	"schedule_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_search_id" uuid NOT NULL,
	"vacancy_id" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"telegram_chat_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_logs_saved_search_id_idx" ON "notification_logs" USING btree ("saved_search_id");--> statement-breakpoint
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sent_notifications_search_vacancy_idx" ON "sent_notifications" USING btree ("saved_search_id","vacancy_id");--> statement-breakpoint
CREATE INDEX "sent_notifications_saved_search_id_idx" ON "sent_notifications" USING btree ("saved_search_id");