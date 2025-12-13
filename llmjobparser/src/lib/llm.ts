import { z } from "zod";

import { serverEnv } from "./env";

const parsedPromptSchema = z.object({
  keywords: z.array(z.string()),
  desiredSchedule: z.string().optional(),
});

export type ParsedPrompt = z.infer<typeof parsedPromptSchema>;

export async function parsePromptWithLLM(
  prompt: string,
): Promise<ParsedPrompt> {
  if (!serverEnv.OPENROUTER_API_KEY || !serverEnv.OPENROUTER_BASE_URL) {
    return {
      keywords: prompt
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 5),
      desiredSchedule: undefined,
    };
  }

  const response = await fetch(
    `${serverEnv.OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              'You are a helpful assistant that extracts structured information from job search queries. Extract keywords and desired schedule (if mentioned). Return JSON: {"keywords": ["word1", "word2"], "desiredSchedule": "full-time|part-time|contract|etc or omit if not mentioned"}',
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`LLM prompt parsing failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in LLM response");
  }

  const parsed = JSON.parse(content);
  return parsedPromptSchema.parse(parsed);
}

const badgeScoresSchema = z.array(z.string());

export type BadgeScores = z.infer<typeof badgeScoresSchema>;

export async function scoreVacanciesWithLLM(
  parsedPrompt: ParsedPrompt,
  vacancies: Array<{ id: string; title: string; summary: string }>,
): Promise<Map<string, BadgeScores>> {
  if (!serverEnv.OPENROUTER_API_KEY || !serverEnv.OPENROUTER_BASE_URL) {
    const fallbackScores = new Map<string, BadgeScores>();
    for (const v of vacancies) {
      fallbackScores.set(v.id, ["Relevant"]);
    }
    return fallbackScores;
  }

  const vacancyText = vacancies
    .map((v) => `ID: ${v.id}\nTitle: ${v.title}\nSummary: ${v.summary}`)
    .join("\n\n---\n\n");

  const response = await fetch(
    `${serverEnv.OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that scores job vacancies based on search criteria. For each vacancy, return 1-3 badge labels describing relevance (e.g., "Highly Relevant", "Remote-Friendly", "Senior", etc.). Return JSON: {"scores": {"vacancy_id": ["badge1", "badge2"], ...}}`,
          },
          {
            role: "user",
            content: `Search keywords: ${parsedPrompt.keywords.join(", ")}\nDesired schedule: ${parsedPrompt.desiredSchedule || "any"}\n\nVacancies:\n${vacancyText}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`LLM scoring failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in LLM scoring response");
  }

  const parsed = JSON.parse(content);
  const scoresObj = z
    .record(z.string(), badgeScoresSchema)
    .parse(parsed.scores || {});

  const result = new Map<string, BadgeScores>();
  for (const [id, badges] of Object.entries(scoresObj)) {
    result.set(id, badges as BadgeScores);
  }
  return result;
}
