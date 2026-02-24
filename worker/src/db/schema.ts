import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  timestamp, integer, uniqueIndex, index,
} from "drizzle-orm/pg-core";

/* ── Enums ─────────────────────────────────────────── */
export const planEnum = pgEnum("plan_enum", ["FREE", "PRO", "BUSINESS"]);
export const changeTypeEnum = pgEnum("change_type_enum", [
  "TOS_UPDATE", "PRIVACY_UPDATE", "API_CHANGE", "PRICING_CHANGE", "DATA_POLICY",
]);
export const severityEnum = pgEnum("severity_enum", ["CRITICAL", "MAJOR", "MINOR", "PATCH"]);
export const alertChannelEnum = pgEnum("alert_channel_enum", ["EMAIL", "WEBHOOK", "SLACK"]);
export const alertStatusEnum = pgEnum("alert_status_enum", ["SENT", "FAILED", "PENDING"]);

/* ── Users ─────────────────────────────────────────── */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  plan: planEnum("plan").notNull().default("FREE"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Services ──────────────────────────────────────── */
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  category: varchar("category", { length: 100 }),
  logoUrl: text("logo_url"),
  website: text("website"),
  tosUrl: text("tos_url"),
  privacyUrl: text("privacy_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Snapshots ─────────────────────────────────────── */
export const snapshots = pgTable("snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_snapshots_service_fetched").on(t.serviceId, t.fetchedAt),
]);

/* ── Changes ───────────────────────────────────────── */
export const changes = pgTable("changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  snapshotOldId: uuid("snapshot_old_id").references(() => snapshots.id),
  snapshotNewId: uuid("snapshot_new_id").references(() => snapshots.id),
  changeType: changeTypeEnum("change_type").notNull(),
  severity: severityEnum("severity").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary").notNull(),
  diffHtml: text("diff_html"),
  sectionsChanged: integer("sections_changed").notNull().default(0),
  wordsAdded: integer("words_added").notNull().default(0),
  wordsRemoved: integer("words_removed").notNull().default(0),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_changes_detected").on(t.detectedAt),
  index("idx_changes_service_detected").on(t.serviceId, t.detectedAt),
]);

/* ── Subscriptions ─────────────────────────────────── */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyWebhook: boolean("notify_webhook").notNull().default(false),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_user_service").on(t.userId, t.serviceId),
]);

/* ── Suggestions ───────────────────────────────────── */
export const suggestions = pgTable("suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  email: varchar("email", { length: 255 }),
  notes: text("notes"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Alerts ────────────────────────────────────────── */
export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  changeId: uuid("change_id").notNull().references(() => changes.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  channel: alertChannelEnum("channel").notNull(),
  status: alertStatusEnum("status").notNull().default("PENDING"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_alerts_change").on(t.changeId),
  index("idx_alerts_user").on(t.userId),
]);
