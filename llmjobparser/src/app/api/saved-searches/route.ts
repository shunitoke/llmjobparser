import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema";

const createSearchSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  prompt: z.string().min(5).max(2000),
  regions: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  includePrivate: z.boolean().default(false),
  scheduleEnabled: z.boolean().default(false),
  scheduleType: z.enum(["daily", "weekly", "custom"]).optional(),
  scheduleCron: z.string().optional(),
});

export async function GET(req: Request) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const searches = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(savedSearches.createdAt);

    return NextResponse.json({ searches });
  } catch (error) {
    console.error("Failed to fetch saved searches:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved searches" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const body = await req.json();
    const parsed = createSearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (data.scheduleEnabled && data.scheduleType === "custom") {
      if (!data.scheduleCron) {
        return NextResponse.json(
          { error: "scheduleCron required for custom schedule type" },
          { status: 400 },
        );
      }
    } else if (data.scheduleEnabled && data.scheduleType === "daily") {
      data.scheduleCron = "0 9 * * *";
    } else if (data.scheduleEnabled && data.scheduleType === "weekly") {
      data.scheduleCron = "0 9 * * 1";
    }

    const [search] = await db
      .insert(savedSearches)
      .values({
        userId: data.userId,
        name: data.name,
        prompt: data.prompt,
        regions: data.regions,
        categories: data.categories,
        includePrivate: data.includePrivate,
        scheduleEnabled: data.scheduleEnabled,
        scheduleType: data.scheduleType,
        scheduleCron: data.scheduleCron,
      })
      .returning();

    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    console.error("Failed to create saved search:", error);
    return NextResponse.json(
      { error: "Failed to create saved search" },
      { status: 500 },
    );
  }
}
