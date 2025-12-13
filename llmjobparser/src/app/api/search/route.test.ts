import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import * as kvModule from "@/lib/kv";
import * as llmModule from "@/lib/llm";
import * as scraperModule from "@/lib/scraper-worker";
import type { VacancyBatch } from "@/lib/types";

import { POST } from "./route";

type MockKv = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/kv", () => ({
  kv: null,
}));

vi.mock("@/lib/llm", () => ({
  parsePromptWithLLM: vi.fn(),
  scoreVacanciesWithLLM: vi.fn(),
}));

vi.mock("@/lib/scraper-worker", () => ({
  enqueueFetch: vi.fn(),
}));

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return 400 for invalid input", async () => {
    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({ prompt: "abc" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Invalid request");
  });

  it("should parse prompt without KV (cache miss)", async () => {
    vi.mocked(llmModule.parsePromptWithLLM).mockResolvedValue({
      keywords: ["engineer", "backend"],
      desiredSchedule: "full-time",
    });

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: [],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.items).toEqual([]);
    expect(json.batchStatus).toBeDefined();
    expect(llmModule.parsePromptWithLLM).toHaveBeenCalledWith(
      "Looking for backend engineer position",
    );
  });

  it("should use cached prompt when KV is available (cache hit)", async () => {
    const mockKv: MockKv = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.spyOn(kvModule, "kv", "get").mockReturnValue(
      mockKv as unknown as typeof kvModule.kv,
    );

    const cachedPrompt = {
      keywords: ["cached", "keywords"],
      desiredSchedule: "part-time",
    };

    mockKv.get.mockResolvedValue(cachedPrompt);

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: [],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mockKv.get).toHaveBeenCalled();
    expect(llmModule.parsePromptWithLLM).not.toHaveBeenCalled();
  });

  it("should fetch and store prompt when cache misses", async () => {
    const mockKv: MockKv = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.spyOn(kvModule, "kv", "get").mockReturnValue(
      mockKv as unknown as typeof kvModule.kv,
    );

    mockKv.get.mockResolvedValue(null);

    const parsedPrompt = {
      keywords: ["engineer", "backend"],
      desiredSchedule: "full-time",
    };

    vi.mocked(llmModule.parsePromptWithLLM).mockResolvedValue(parsedPrompt);

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: [],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(llmModule.parsePromptWithLLM).toHaveBeenCalledWith(
      "Looking for backend engineer position",
    );
    expect(mockKv.set).toHaveBeenCalledWith(
      expect.stringContaining("parsed_prompt:"),
      parsedPrompt,
      { ex: 3600 },
    );
  });

  it("should retrieve vacancies from KV when available", async () => {
    const mockKv: MockKv = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.spyOn(kvModule, "kv", "get").mockReturnValue(
      mockKv as unknown as typeof kvModule.kv,
    );

    const parsedPrompt = {
      keywords: ["engineer", "backend"],
      desiredSchedule: "full-time",
    };

    const vacancyBatch: VacancyBatch = {
      vacancies: [
        {
          id: "job-1",
          title: "Backend Engineer",
          company: "Tech Co",
          location: "Remote",
          summary: "Great job",
          badges: [],
        },
      ],
      pending: false,
      lastFetched: Date.now(),
    };

    mockKv.get.mockImplementation(async (key: string) => {
      if (key.startsWith("parsed_prompt:")) return parsedPrompt;
      if (key.startsWith("vacancies:")) return vacancyBatch;
      if (key.startsWith("scores:")) return ["Relevant"];
      return null;
    });

    vi.mocked(llmModule.scoreVacanciesWithLLM).mockResolvedValue(
      new Map([["job-1", ["Relevant"]]]),
    );

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: ["Remote"],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].title).toBe("Backend Engineer");
    expect(json.items[0].badges).toEqual(["Relevant"]);
  });

  it("should trigger refresh when batch is missing or stale", async () => {
    const mockKv: MockKv = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.spyOn(kvModule, "kv", "get").mockReturnValue(
      mockKv as unknown as typeof kvModule.kv,
    );

    const parsedPrompt = {
      keywords: ["engineer", "backend"],
      desiredSchedule: "full-time",
    };

    mockKv.get.mockImplementation(async (key: string) => {
      if (key.startsWith("parsed_prompt:")) return parsedPrompt;
      if (key.startsWith("vacancies:")) return null;
      return null;
    });

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: ["Remote"],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(scraperModule.enqueueFetch).toHaveBeenCalledWith("public", "Remote");

    const json = await response.json();
    expect(json.items).toEqual([]);
    expect(json.batchStatus).toMatchObject({
      "vacancies:public:b71199ebd070b36b": {
        pending: true,
        refreshTriggered: true,
      },
    });
  });

  it("should cache scores for vacancies", async () => {
    const mockKv: MockKv = {
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.spyOn(kvModule, "kv", "get").mockReturnValue(
      mockKv as unknown as typeof kvModule.kv,
    );

    const parsedPrompt = {
      keywords: ["engineer", "backend"],
      desiredSchedule: "full-time",
    };

    const vacancyBatch: VacancyBatch = {
      vacancies: [
        {
          id: "job-1",
          title: "Backend Engineer",
          company: "Tech Co",
          location: "Remote",
          summary: "Great job",
          badges: [],
        },
        {
          id: "job-2",
          title: "Senior Backend Engineer",
          company: "Another Co",
          location: "Remote",
          summary: "Another great job",
          badges: [],
        },
      ],
      pending: false,
      lastFetched: Date.now(),
    };

    mockKv.get.mockImplementation(async (key: string) => {
      if (key.startsWith("parsed_prompt:")) return parsedPrompt;
      if (key.startsWith("vacancies:")) return vacancyBatch;
      if (key === "scores:job-1") return ["Cached Badge"];
      return null;
    });

    vi.mocked(llmModule.scoreVacanciesWithLLM).mockResolvedValue(
      new Map([["job-2", ["New Badge"]]]),
    );

    const request = new Request("http://localhost/api/search", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Looking for backend engineer position",
        regions: ["Remote"],
        categories: [],
        includePrivate: false,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const setCalls = mockKv.set.mock.calls.filter((call) =>
      call[0].startsWith("scores:"),
    );
    expect(setCalls.length).toBeGreaterThan(0);

    const json = await response.json();
    expect(json.items).toHaveLength(2);
  });
});
