import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    regions: jsonb("regions").$type<string[]>().notNull().default([]),
    categories: jsonb("categories").$type<string[]>().notNull().default([]),
    includePrivate: boolean("include_private").notNull().default(false),
    scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
    scheduleCron: text("schedule_cron"),
    scheduleType: text("schedule_type"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("saved_searches_user_id_idx").on(table.userId),
  }),
);

export const sentNotifications = pgTable(
  "sent_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    savedSearchId: uuid("saved_search_id")
      .references(() => savedSearches.id, { onDelete: "cascade" })
      .notNull(),
    vacancyId: text("vacancy_id").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => ({
    searchVacancyIdx: index("sent_notifications_search_vacancy_idx").on(
      table.savedSearchId,
      table.vacancyId,
    ),
    savedSearchIdIdx: index("sent_notifications_saved_search_id_idx").on(
      table.savedSearchId,
    ),
  }),
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    savedSearchId: uuid("saved_search_id")
      .references(() => savedSearches.id, { onDelete: "cascade" })
      .notNull(),
    vacancyCount: text("vacancy_count").notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (table) => ({
    savedSearchIdIdx: index("notification_logs_saved_search_id_idx").on(
      table.savedSearchId,
    ),
  }),
);
