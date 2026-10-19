import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const TRANSACTION_SOURCES = ["manual", "csv", "xlsx", "invoice"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendor: text("vendor").notNull(),
  date: integer("date").notNull(),
  total_minor: integer("total_minor").notNull(),
  net_minor: integer("net_minor").notNull().default(0),
  vat_minor: integer("vat_minor").notNull().default(0),
  gross_minor: integer("gross_minor").notNull().default(0),
  currency_code: text("currency_code").notNull(),
  project: text("project").notNull(),
  status: text("status", { enum: ["needs_review", "confirmed"] }).notNull(),
  content_hash: text("content_hash"),
  source_image: text("source_image"),
  source_image_mime: text("source_image_mime"),
  line_items: text("line_items").notNull(),
  raw_llm_response: text("raw_llm_response").notNull(),
  created_at: integer("created_at").$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: integer("date").notNull(),
  amount_minor: integer("amount_minor").notNull(),
  net_minor: integer("net_minor"),
  gross_minor: integer("gross_minor"),
  currency_code: text("currency_code").notNull(),
  category: text("category").notNull(),
  project: text("project").notNull(),
  description: text("description").notNull().default(""),
  source: text("source", { enum: TRANSACTION_SOURCES }).notNull().default("manual"),
  source_invoice_id: text("source_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  created_at: integer("created_at").$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Setting = typeof settings.$inferSelect;
