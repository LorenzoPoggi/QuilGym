import { relations, sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};

export const productStatus = pgEnum("product_status", ["active", "draft", "archived"]);

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brandId: integer("brand_id").references(() => brands.id, { onDelete: "restrict" }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  description: text("description"),
  status: productStatus("status").notNull().default("draft"),
  isFeatured: boolean("is_featured").notNull().default(false),
  ...timestamps,
}, (table) => [
  index("products_category_idx").on(table.categoryId),
  index("products_brand_idx").on(table.brandId),
  index("products_status_idx").on(table.status),
]);

/**
 * Importes en pesos enteros (ARS). `stock` null significa que todavía no se
 * controla inventario para esa variante: se vende como disponible.
 */
export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  label: text("label"),
  priceArs: integer("price_ars").notNull(),
  compareAtPriceArs: integer("compare_at_price_ars"),
  stock: integer("stock"),
  isDefault: boolean("is_default").notNull().default(false),
  position: integer("position").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("product_variants_product_idx").on(table.productId),
  uniqueIndex("product_variants_one_default_idx").on(table.productId).where(sql`${table.isDefault}`),
  check("product_variants_price_check", sql`${table.priceArs} >= 0`),
  check("product_variants_compare_at_check", sql`${table.compareAtPriceArs} is null or ${table.compareAtPriceArs} > ${table.priceArs}`),
  check("product_variants_stock_check", sql`${table.stock} is null or ${table.stock} >= 0`),
]);

export const brandsRelations = relations(brands, ({ many }) => ({ products: many(products) }));
export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
