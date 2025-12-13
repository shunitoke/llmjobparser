import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import {
  hashPrompt,
  hashRegion,
  parsedPromptKey,
  scoreKey,
  vacanciesKey,
} from "@/lib/cache-keys";
import { db } from "@/lib/db/client";
import {
  notificationLogs,
  savedSearches,
  sentNotifications,
  users,
} from "@/lib/db/schema";
import { kv } from "@/lib/kv";
import { parsePromptWithLLM, type ParsedPrompt } from "@/lib/llm";
import { batchScoreVacancies } from "@/lib/scoring-batcher";
import { getAdminChatId, getTelegramBot } from "@/lib/telegram";
import type { Vacancy, VacancyBatch } from "@/lib/types";

const PROMPT_TTL = 3600;
const SCORE_TTL = 3600;
const BATCH_STALE_THRESHOLD = 3600 * 1000;

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const telegramBot = getTelegramBot();
  const adminChatId = getAdminChatId();

  if (!telegramBot || !adminChatId) {
    console.warn(
      "Telegram bot not configured, notifications will be logged only",
    );
  }

  try {
    const enabledSearches = await db
      .select({
        search: savedSearches,
        user: users,
      })
      .from(savedSearches)
      .innerJoin(users, eq(savedSearches.userId, users.id))
      .where(eq(savedSearches.scheduleEnabled, true));

    console.log(`Processing ${enabledSearches.length} enabled searches`);

    const results = [];

    for (const { search, user } of enabledSearches) {
      try {
        const newVacancies = await processSearch(search);

        if (newVacancies.length === 0) {
          console.log(`No new vacancies for search ${search.id}`);
          continue;
        }

        const chatId = user.telegramChatId || adminChatId;

        if (telegramBot && chatId) {
          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const message = telegramBot.formatVacancyNotification(
            search.name,
            newVacancies,
            appUrl,
          );

          await telegramBot.sendMessage(chatId, message, "Markdown");
        }

        await db.insert(notificationLogs).values({
          savedSearchId: search.id,
          vacancyCount: newVacancies.length.toString(),
          status: "success",
        });

        results.push({
          searchId: search.id,
          searchName: search.name,
          newVacanciesCount: newVacancies.length,
          status: "success",
        });
      } catch (error) {
        console.error(`Failed to process search ${search.id}:`, error);

        await db.insert(notificationLogs).values({
          savedSearchId: search.id,
          vacancyCount: "0",
          status: "error",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });

        results.push({
          searchId: search.id,
          searchName: search.name,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      processed: enabledSearches.length,
      results,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function processSearch(
  search: typeof savedSearches.$inferSelect,
): Promise<Vacancy[]> {
  if (!db) {
    throw new Error("Database not configured");
  }

  const { prompt, regions, includePrivate, id: searchId } = search;

  const promptHash = hashPrompt(prompt);
  let parsedPrompt: ParsedPrompt;

  if (kv) {
    const cached = await kv.get<ParsedPrompt>(parsedPromptKey(promptHash));
    if (cached) {
      parsedPrompt = cached;
    } else {
      parsedPrompt = await parsePromptWithLLM(prompt);
      await kv.set(parsedPromptKey(promptHash), parsedPrompt, {
        ex: PROMPT_TTL,
      });
    }
  } else {
    parsedPrompt = await parsePromptWithLLM(prompt);
  }

  const allVacancies: Vacancy[] = [];
  const sources = includePrivate ? ["public", "private"] : ["public"];
  const searchRegions =
    Array.isArray(regions) && regions.length > 0 ? regions : ["Remote"];

  for (const region of searchRegions) {
    const regionHash = hashRegion(region);

    for (const source of sources) {
      const key = vacanciesKey(source, regionHash);

      if (kv) {
        const batch = await kv.get<VacancyBatch>(key);
        if (batch && !isBatchStale(batch)) {
          allVacancies.push(...batch.vacancies);
        }
      }
    }
  }

  if (allVacancies.length === 0) {
    return [];
  }

  const vacanciesForScoring = allVacancies.map((v) => ({
    id: v.id,
    title: v.title,
    summary: v.summary,
  }));

  let scoreMap: Map<string, string[]>;

  if (kv) {
    scoreMap = new Map();
    const uncachedVacancies: typeof vacanciesForScoring = [];

    for (const v of vacanciesForScoring) {
      const cached = await kv.get<string[]>(scoreKey(promptHash, v.id));
      if (cached) {
        scoreMap.set(v.id, cached);
      } else {
        uncachedVacancies.push(v);
      }
    }

    if (uncachedVacancies.length > 0) {
      const newScores = await batchScoreVacancies(
        parsedPrompt,
        uncachedVacancies,
      );
      for (const [id, badges] of newScores.entries()) {
        scoreMap.set(id, badges);
        await kv.set(scoreKey(promptHash, id), badges, { ex: SCORE_TTL });
      }
    }
  } else {
    scoreMap = await batchScoreVacancies(parsedPrompt, vacanciesForScoring);
  }

  const itemsWithScores = allVacancies.map((v) => ({
    ...v,
    badges: scoreMap.get(v.id) || [],
  }));

  const alreadySent = await db
    .select({
      vacancyId: sentNotifications.vacancyId,
    })
    .from(sentNotifications)
    .where(eq(sentNotifications.savedSearchId, searchId));

  const sentVacancyIds = new Set(alreadySent.map((s) => s.vacancyId));

  const newVacancies = itemsWithScores.filter((v) => !sentVacancyIds.has(v.id));

  if (newVacancies.length > 0) {
    await db.insert(sentNotifications).values(
      newVacancies.map((v) => ({
        savedSearchId: searchId,
        vacancyId: v.id,
      })),
    );
  }

  return newVacancies;
}

function isBatchStale(batch: VacancyBatch): boolean {
  if (!batch.lastFetched) return true;
  return Date.now() - batch.lastFetched > BATCH_STALE_THRESHOLD;
}
