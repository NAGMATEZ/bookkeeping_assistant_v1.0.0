import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendor: text("vendor").notNull(),
  date: integer("date").notNull(),
  total_minor: integer("total_minor").notNull(),
  currency_code: text("currency_code").notNull(),
  project: text("project").notNull(),
  status: text("status", { enum: ["needs_review", "confirmed"] }).notNull(),
  source_image: text("source_image"),
  line_items: text("line_items").notNull(),
  raw_llm_response: text("raw_llm_response").notNull(),
  created_at: integer("created_at").$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: integer("date").notNull(),
  amount_minor: integer("amount_minor").notNull(),
  currency_code: text("currency_code").notNull(),
  category: text("category").notNull(),
  project: text("project").notNull(),
  description: text("description").notNull().default(""),
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