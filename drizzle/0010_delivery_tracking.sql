ALTER TYPE "public"."delivery_method" ADD VALUE 'local';--> statement-breakpoint
CREATE TABLE "courier_positions" (
	"shipment_id" uuid PRIMARY KEY NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courier_positions_point_check" CHECK ("courier_positions"."lat" between -90 and 90 and "courier_positions"."lng" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "order_delivery" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"option_id" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"distance_m" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_delivery_point_check" CHECK (("order_delivery"."lat" is null and "order_delivery"."lng" is null) or ("order_delivery"."lat" between -90 and 90 and "order_delivery"."lng" between -180 and 180)),
	CONSTRAINT "order_delivery_distance_check" CHECK ("order_delivery"."distance_m" is null or "order_delivery"."distance_m" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"lat" double precision,
	"lng" double precision,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_events_source_check" CHECK ("shipment_events"."source" in ('admin', 'carrier'))
);
--> statement-breakpoint
CREATE TABLE "shipment_tracking" (
	"shipment_id" uuid PRIMARY KEY NOT NULL,
	"carrier" text NOT NULL,
	"service_id" text,
	"carrier_shipment_id" text,
	"tracking_url" text,
	"eta_from" timestamp with time zone,
	"eta_to" timestamp with time zone,
	"tracking_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_tracking_carrier_check" CHECK ("shipment_tracking"."carrier" in ('own', 'correo_argentino', 'mock'))
);
--> statement-breakpoint
CREATE TABLE "variant_shipping" (
	"variant_id" integer PRIMARY KEY NOT NULL,
	"weight_grams" integer,
	"length_cm" integer,
	"width_cm" integer,
	"height_cm" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_shipping_values_check" CHECK (("variant_shipping"."weight_grams" is null or "variant_shipping"."weight_grams" > 0) and ("variant_shipping"."length_cm" is null or "variant_shipping"."length_cm" > 0) and ("variant_shipping"."width_cm" is null or "variant_shipping"."width_cm" > 0) and ("variant_shipping"."height_cm" is null or "variant_shipping"."height_cm" > 0))
);
--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_cash_pickup_check";--> statement-breakpoint
ALTER TABLE "courier_positions" ADD CONSTRAINT "courier_positions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_delivery" ADD CONSTRAINT "order_delivery_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_tracking" ADD CONSTRAINT "shipment_tracking_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_shipping" ADD CONSTRAINT "variant_shipping_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_events_dedupe_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at","description");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cash_pickup_check" CHECK ("orders"."payment_method" <> 'cash' or "orders"."delivery"::text in ('pickup', 'local'));