import { eq } from "drizzle-orm";

import { db } from "./client";
import { users } from "./schema";
import type { NewUser } from "./types";

export async function getOrCreateUser(email: string, data?: Partial<NewUser>) {
  if (!db) {
    throw new Error("Database not configured");
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: data?.name,
      telegramChatId: data?.telegramChatId,
    })
    .returning();

  return user;
}
