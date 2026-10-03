CREATE TYPE "public"."delivery_method" AS ENUM('pickup', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mercadopago', 'transfer', 'cash');--> statement-breakpoint
CREATE TABLE "order_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event" text NOT NULL,
	"sent_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" integer NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"variant_label" text,
	"slug" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_ars" integer NOT NULL,
	"stock_reserved" boolean NOT NULL,
	CONSTRAINT "order_items_values_check" CHECK ("order_items"."quantity" > 0 and "order_items"."unit_price_ars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"checkout_key" uuid NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"delivery" "delivery_method" NOT NULL,
	"address" jsonb,
	"notes" text DEFAULT '' NOT NULL,
	"pickup_details" jsonb,
	"bank_details" jsonb,
	"subtotal_ars" integer NOT NULL,
	"discount_ars" integer NOT NULL,
	"shipping_ars" integer NOT NULL,
	"total_ars" integer NOT NULL,
	"coupon_code" text,
	"consent_at" timestamp with time zone NOT NULL,
	"resources_released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_totals_check" CHECK ("orders"."subtotal_ars" >= 0 and "orders"."discount_ars" >= 0 and "orders"."discount_ars" <= "orders"."subtotal_ars" and "orders"."shipping_ars" >= 0 and "orders"."total_ars" = "orders"."subtotal_ars" - "orders"."discount_ars" + "orders"."shipping_ars"),
	CONSTRAINT "orders_cash_pickup_check" CHECK ("orders"."payment_method" <> 'cash' or "orders"."delivery" = 'pickup')
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider_id" text,
	"preference_id" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"provider_updated_at" timestamp with time zone,
	"ticket_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payments_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"label" text NOT NULL,
	"estimate" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tracking_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_emails_event_idx" ON "order_emails" USING btree ("order_id","event");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_cart_checkout_idx" ON "orders" USING btree ("cart_id","checkout_key");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");