CREATE TABLE "order_item_costs" (
	"order_item_id" integer PRIMARY KEY NOT NULL,
	"unit_cost_ars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_costs_cost_check" CHECK ("order_item_costs"."unit_cost_ars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payment_fees" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"fee_ars" integer NOT NULL,
	"net_received_ars" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_fees_fee_check" CHECK ("payment_fees"."fee_ars" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_costs" (
	"variant_id" integer PRIMARY KEY NOT NULL,
	"cost_ars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_costs_cost_check" CHECK ("product_costs"."cost_ars" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_item_costs" ADD CONSTRAINT "order_item_costs_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_fees" ADD CONSTRAINT "payment_fees_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;