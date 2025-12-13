import { beforeEach, describe, expect, it, vi } from "vitest";

import * as llm from "./llm";
import { BATCH_SIZE, batchScoreVacancies } from "./scoring-batcher";

vi.mock("./llm", () => ({
  scoreVacanciesWithLLM: vi.fn(),
}));

describe("scoring-batcher", () => {
  const mockParsedPrompt = {
    keywords: ["engineer", "backend"],
    desiredSchedule: "full-time",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process a single batch", async () => {
    const vacancies = Array.from({ length: 10 }, (_, i) => ({
      id: `job-${i}`,
      title: `Job ${i}`,
      summary: `Summary ${i}`,
    }));

    const mockScores = new Map(vacancies.map((v) => [v.id, ["Relevant"]]));

    vi.mocked(llm.scoreVacanciesWithLLM).mockResolvedValue(mockScores);

    const result = await batchScoreVacancies(mockParsedPrompt, vacancies);

    expect(llm.scoreVacanciesWithLLM).toHaveBeenCalledTimes(1);
    expect(llm.scoreVacanciesWithLLM).toHaveBeenCalledWith(
      mockParsedPrompt,
      vacancies,
    );
    expect(result.size).toBe(10);
    expect(result.get("job-0")).toEqual(["Relevant"]);
  });

  it("should split vacancies into multiple batches", async () => {
    const vacancies = Array.from({ length: 45 }, (_, i) => ({
      id: `job-${i}`,
      title: `Job ${i}`,
      summary: `Summary ${i}`,
    }));

    vi.mocked(llm.scoreVacanciesWithLLM).mockImplementation(
      async (_, batch) => {
        return new Map(batch.map((v) => [v.id, ["Relevant"]]));
      },
    );

    const result = await batchScoreVacancies(mockParsedPrompt, vacancies);

    expect(llm.scoreVacanciesWithLLM).toHaveBeenCalledTimes(3);
    expect(result.size).toBe(45);

    const firstCall = vi.mocked(llm.scoreVacanciesWithLLM).mock.calls[0];
    expect(firstCall[1]).toHaveLength(BATCH_SIZE);

    const secondCall = vi.mocked(llm.scoreVacanciesWithLLM).mock.calls[1];
    expect(secondCall[1]).toHaveLength(BATCH_SIZE);

    const thirdCall = vi.mocked(llm.scoreVacanciesWithLLM).mock.calls[2];
    expect(thirdCall[1]).toHaveLength(5);
  });

  it("should handle empty vacancy list", async () => {
    const result = await batchScoreVacancies(mockParsedPrompt, []);

    expect(llm.scoreVacanciesWithLLM).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it("should aggregate scores from all batches", async () => {
    const vacancies = Array.from({ length: 30 }, (_, i) => ({
      id: `job-${i}`,
      title: `Job ${i}`,
      summary: `Summary ${i}`,
    }));

    let batchNumber = 0;
    vi.mocked(llm.scoreVacanciesWithLLM).mockImplementation(
      async (_, batch) => {
        batchNumber++;
        return new Map(batch.map((v) => [v.id, [`Batch${batchNumber}`]]));
      },
    );

    const result = await batchScoreVacancies(mockParsedPrompt, vacancies);

    expect(result.size).toBe(30);
    expect(result.get("job-0")).toEqual(["Batch1"]);
    expect(result.get("job-20")).toEqual(["Batch2"]);
  });
});
