import type { ParsedPrompt } from "./llm";
import { scoreVacanciesWithLLM } from "./llm";

export const BATCH_SIZE = 20;

export type VacancyForScoring = {
  id: string;
  title: string;
  summary: string;
};

export async function batchScoreVacancies(
  parsedPrompt: ParsedPrompt,
  vacancies: VacancyForScoring[],
): Promise<Map<string, string[]>> {
  const allScores = new Map<string, string[]>();

  for (let i = 0; i < vacancies.length; i += BATCH_SIZE) {
    const batch = vacancies.slice(i, i + BATCH_SIZE);
    const batchScores = await scoreVacanciesWithLLM(parsedPrompt, batch);

    for (const [id, badges] of batchScores.entries()) {
      allScores.set(id, badges);
    }
  }

  return allScores;
}
