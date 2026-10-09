CREATE TABLE "product_stock_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"variant_id" integer,
	"sku" text NOT NULL,
	"previous_stock" integer,
	"new_stock" integer,
	"source" text DEFAULT 'admin' NOT NULL,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_stock_changes" ADD CONSTRAINT "product_stock_changes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stock_changes" ADD CONSTRAINT "product_stock_changes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_stock_changes_product_idx" ON "product_stock_changes" USING btree ("product_id","created_at");