import { relations, sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

export const productImageKind = pgEnum("product_image_kind", ["product", "nutrition"]);

/** Galería del producto: fotos del envase y rótulos de información nutricional. */
export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  /** Ruta pública (p. ej. /assets/products/<slug>/01.webp) o URL absoluta de un storage. */
  url: text("url").notNull(),
  kind: productImageKind("kind").notNull().default("product"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  position: integer("position").notNull().default(0),
  ...timestamps,
}, (table) => [index("product_images_product_idx").on(table.productId, table.position)]);

/** Carrito de invitado; el id (uuid aleatorio) viaja en una cookie HttpOnly. */
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  couponCode: text("coupon_code"),
  ...timestamps,
});

export const cartItems = pgTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  /** Precio unitario que vio el cliente; sirve solo para avisar cambios, nunca para cobrar. */
  seenPriceArs: integer("seen_price_ars").notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("cart_items_cart_variant_idx").on(table.cartId, table.variantId),
  check("cart_items_quantity_check", sql`${table.quantity} > 0`),
]);

export const couponKind = pgEnum("coupon_kind", ["percent", "fixed"]);

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  /** Siempre en mayúsculas. */
  code: text("code").notNull().unique(),
  description: text("description"),
  kind: couponKind("kind").notNull(),
  /** Porcentaje (1–100) o monto fijo en ARS según `kind`. */
  value: integer("value").notNull(),
  minSubtotalArs: integer("min_subtotal_ars"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
}, (table) => [
  check("coupons_value_check", sql`${table.value} > 0 and (${table.kind} = 'fixed' or ${table.value} <= 100)`),
]);

export const cartsRelations = relations(carts, ({ many }) => ({ items: many(cartItems) }));
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const brandsRelations =relations(brands, ({ many }) => ({ products: many(products) }));
export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export type Brand = typeof brands.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;

export const orderStatus = pgEnum("order_status", ["pending", "approved", "rejected", "cancelled", "refunded"]);
export const deliveryMethod = pgEnum("delivery_method", ["pickup", "shipping"]);
export const paymentMethod = pgEnum("payment_method", ["mercadopago", "transfer", "cash"]);

/** Better Auth: sesiones revocables y credenciales con hash, nunca contraseñas en claro. */
export const users = pgTable("users", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  ...timestamps,
});
export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), ...timestamps,
}, (t) => [index("auth_sessions_user_idx").on(t.userId)]);
export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), password: text("password"),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), scope: text("scope"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), ...timestamps,
}, (t) => [index("auth_accounts_user_idx").on(t.userId), uniqueIndex("auth_accounts_provider_idx").on(t.providerId, t.accountId)]);
export const authVerifications = pgTable("auth_verifications", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), ...timestamps,
}, (t) => [index("auth_verifications_identifier_idx").on(t.identifier)]);
export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(), key: text("key").notNull().unique(), count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const favorites = pgTable("favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("favorites_user_product_idx").on(t.userId, t.productId)]);

/** Búsquedas recientes privadas de cada cuenta. */
export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  normalizedQuery: text("normalized_query").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("search_history_user_query_idx").on(t.userId, t.normalizedQuery),
  index("search_history_user_created_idx").on(t.userId, t.createdAt),
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "restrict" }),
  checkoutKey: uuid("checkout_key").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  status: orderStatus("status").notNull().default("pending"),
  paymentMethod: paymentMethod("payment_method").notNull(),
  paymentChoice: text("payment_choice").notNull().default("mercadopago"),
  name: text("name").notNull(), email: text("email").notNull(), phone: text("phone").notNull(),
  delivery: deliveryMethod("delivery").notNull(),
  address: jsonb("address").$type<{ street: string; number: string; apartment: string; postalCode: string; city: string; province: string }>(),
  notes: text("notes").notNull().default(""),
  pickupDetails: jsonb("pickup_details").$type<{ address: string; hours: string }>(),
  bankDetails: jsonb("bank_details").$type<{ account: string; holder: string; taxId: string }>(),
  subtotalArs: integer("subtotal_ars").notNull(), discountArs: integer("discount_ars").notNull(),
  shippingArs: integer("shipping_ars").notNull(), totalArs: integer("total_ars").notNull(),
  couponCode: text("coupon_code"),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  resourcesReleasedAt: timestamp("resources_released_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("orders_cart_checkout_idx").on(t.cartId, t.checkoutKey),
  index("orders_status_idx").on(t.status),
  check("orders_totals_check", sql`${t.subtotalArs} >= 0 and ${t.discountArs} >= 0 and ${t.discountArs} <= ${t.subtotalArs} and ${t.shippingArs} >= 0 and ${t.totalArs} = ${t.subtotalArs} - ${t.discountArs} + ${t.shippingArs}`),
  check("orders_cash_pickup_check", sql`${t.paymentMethod} <> 'cash' or ${t.delivery} = 'pickup'`),
]);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "restrict" }),
  sku: text("sku").notNull(), name: text("name").notNull(), variantLabel: text("variant_label"), slug: text("slug").notNull(),
  quantity: integer("quantity").notNull(), unitPriceArs: integer("unit_price_ars").notNull(),
  stockReserved: boolean("stock_reserved").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_values_check", sql`${t.quantity} > 0 and ${t.unitPriceArs} >= 0`)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  providerId: text("provider_id").unique(), preferenceId: text("preference_id"),
  status: orderStatus("status").notNull().default("pending"),
  providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
  ticketUrl: text("ticket_url"),
  ...timestamps,
});

export const shipments = pgTable("shipments", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  label: text("label").notNull(), estimate: text("estimate").notNull(),
  status: text("status").notNull().default("pending"), trackingCode: text("tracking_code"),
  ...timestamps,
});

export const orderEmails = pgTable("order_emails", {
  id: uuid("id").primaryKey().defaultRandom(), orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  event: text("event").notNull(), sentAt: timestamp("sent_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  ...timestamps,
}, (t) => [uniqueIndex("order_emails_event_idx").on(t.orderId, t.event)]);
