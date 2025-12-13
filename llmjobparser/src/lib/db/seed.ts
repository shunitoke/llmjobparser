import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

async function seed() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not set");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  const [user] = await db
    .insert(schema.users)
    .values({
      email: "dev@example.com",
      name: "Dev User",
      telegramChatId: "123456789",
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: {
        name: "Dev User",
        telegramChatId: "123456789",
      },
    })
    .returning();

  console.log("Created user:", user.email);

  const [savedSearch] = await db
    .insert(schema.savedSearches)
    .values({
      userId: user.id,
      name: "Senior Backend Engineer",
      prompt:
        "Senior backend engineer with Node.js and TypeScript, remote in Europe",
      regions: ["Remote", "Europe"],
      categories: ["Software Engineering"],
      includePrivate: false,
      scheduleEnabled: true,
      scheduleType: "daily",
      scheduleCron: "0 9 * * *",
    })
    .returning();

  console.log("Created saved search:", savedSearch.name);

  await db.insert(schema.savedSearches).values({
    userId: user.id,
    name: "Frontend React Jobs",
    prompt: "React frontend developer, mid-level or senior, remote friendly",
    regions: ["Remote", "North America"],
    categories: ["Software Engineering"],
    includePrivate: false,
    scheduleEnabled: false,
  });

  console.log("Created additional saved search");

  console.log("\nSeed completed successfully!");

  await client.end();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
