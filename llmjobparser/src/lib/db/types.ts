import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

import * as schema from "./schema";

export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type SavedSearch = InferSelectModel<typeof schema.savedSearches>;
export type NewSavedSearch = InferInsertModel<typeof schema.savedSearches>;

export type SentNotification = InferSelectModel<
  typeof schema.sentNotifications
>;
export type NewSentNotification = InferInsertModel<
  typeof schema.sentNotifications
>;

export type NotificationLog = InferSelectModel<typeof schema.notificationLogs>;
export type NewNotificationLog = InferInsertModel<
  typeof schema.notificationLogs
>;
