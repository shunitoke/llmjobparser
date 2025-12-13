import { NextResponse } from "next/server";

import {
  hashPrompt,
  hashRegion,
  parsedPromptKey,
  scoreKey,
  vacanciesKey,
} from "@/lib/cache-keys";
import { kv } from "@/lib/kv";
import { parsePromptWithLLM, type ParsedPrompt } from "@/lib/llm";
import { enqueueFetch } from "@/lib/scraper-worker";
import { batchScoreVacancies } from "@/lib/scoring-batcher";
import { searchInputSchema } from "@/lib/search";
import type { SearchResponse, Vacancy, VacancyBatch } from "@/lib/types";

const PROMPT_TTL = 3600;
const SCORE_TTL = 3600;
const BATCH_STALE_THRESHOLD = 3600 * 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = searchInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { prompt, regions, includePrivate } = parsed.data;

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
  const batchStatus: SearchResponse["batchStatus"] = {};

  const sources = includePrivate ? ["public", "private"] : ["public"];

  for (const region of regions.length > 0 ? regions : ["Remote"]) {
    const regionHash = hashRegion(region);

    for (const source of sources) {
      const key = vacanciesKey(source, regionHash);
      batchStatus[key] = { pending: false };

      if (kv) {
        const batch = await kv.get<VacancyBatch>(key);
        if (batch && !isBatchStale(batch)) {
          allVacancies.push(...batch.vacancies);
        } else {
          await enqueueFetch(source, region);
          batchStatus[key] = { pending: true, refreshTriggered: true };
        }
      } else {
        batchStatus[key] = { pending: true, refreshTriggered: false };
      }
    }
  }

  if (allVacancies.length === 0) {
    return NextResponse.json({
      items: [],
      batchStatus,
    } satisfies SearchResponse);
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

  return NextResponse.json({
    items: itemsWithScores,
    batchStatus,
  } satisfies SearchResponse);
}

function isBatchStale(batch: VacancyBatch): boolean {
  if (!batch.lastFetched) return true;
  return Date.now() - batch.lastFetched > BATCH_STALE_THRESHOLD;
}
