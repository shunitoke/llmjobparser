import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema";

const updateSearchSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  prompt: z.string().min(5).max(2000).optional(),
  regions: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  includePrivate: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  scheduleType: z.enum(["daily", "weekly", "custom"]).optional(),
  scheduleCron: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = updateSearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { userId, ...updates } = parsed.data;

    if (
      updates.scheduleEnabled &&
      updates.scheduleType &&
      !updates.scheduleCron
    ) {
      if (updates.scheduleType === "daily") {
        updates.scheduleCron = "0 9 * * *";
      } else if (updates.scheduleType === "weekly") {
        updates.scheduleCron = "0 9 * * 1";
      }
    }

    const [search] = await db
      .update(savedSearches)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning();

    if (!search) {
      return NextResponse.json(
        { error: "Saved search not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ search });
  } catch (error) {
    console.error("Failed to update saved search:", error);
    return NextResponse.json(
      { error: "Failed to update saved search" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: "Saved search not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete saved search:", error);
    return NextResponse.json(
      { error: "Failed to delete saved search" },
      { status: 500 },
    );
  }
}
