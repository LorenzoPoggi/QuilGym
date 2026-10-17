CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"product_slug" text,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"device" text NOT NULL,
	CONSTRAINT "analytics_events_type_check" CHECK ("analytics_events"."type" in ('page_view', 'product_view', 'add_to_cart', 'checkout_start')),
	CONSTRAINT "analytics_events_device_check" CHECK ("analytics_events"."device" in ('mobile', 'tablet', 'desktop'))
);
--> statement-breakpoint
CREATE TABLE "analytics_order_visitors" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_order_visitors" ADD CONSTRAINT "analytics_order_visitors_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_type_occurred_idx" ON "analytics_events" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id","occurred_at");