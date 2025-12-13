import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function runMigrations() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not set");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("Running migrations...");

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations completed successfully!");

  await client.end();
}

runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
