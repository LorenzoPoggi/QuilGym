CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"voucher_type" text,
	"point_of_sale" integer,
	"number" integer,
	"cae" text,
	"cae_due_date" date,
	"issued_at" timestamp with time zone,
	"amount_ars" integer NOT NULL,
	"receiver_doc_type" text DEFAULT 'CF' NOT NULL,
	"receiver_doc_number" text,
	"receiver_name" text,
	"pdf_url" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"registered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" in ('pending', 'processing', 'issued', 'failed', 'manual')),
	CONSTRAINT "invoices_receiver_check" CHECK ("invoices"."receiver_doc_type" in ('CF', 'DNI', 'CUIT') and ("invoices"."receiver_doc_type" = 'CF' or "invoices"."receiver_doc_number" is not null)),
	CONSTRAINT "invoices_voucher_check" CHECK ("invoices"."voucher_type" is null or "invoices"."voucher_type" in ('A', 'B', 'C')),
	CONSTRAINT "invoices_amount_check" CHECK ("invoices"."amount_ars" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_voucher_idx" ON "invoices" USING btree ("voucher_type","point_of_sale","number");