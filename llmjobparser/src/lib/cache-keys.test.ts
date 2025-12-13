import { describe, expect, it } from "vitest";

import {
  hashPrompt,
  hashRegion,
  parsedPromptKey,
  scoreKey,
  vacanciesKey,
} from "./cache-keys";

describe("cache-keys", () => {
  describe("hashPrompt", () => {
    it("should produce a consistent hash for the same prompt", () => {
      const prompt = "Looking for a backend engineer position";
      const hash1 = hashPrompt(prompt);
      const hash2 = hashPrompt(prompt);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("should normalize case and whitespace", () => {
      const hash1 = hashPrompt("Backend Engineer");
      const hash2 = hashPrompt("backend engineer");
      const hash3 = hashPrompt("  BACKEND ENGINEER  ");
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("should produce different hashes for different prompts", () => {
      const hash1 = hashPrompt("Backend Engineer");
      const hash2 = hashPrompt("Frontend Engineer");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("hashRegion", () => {
    it("should produce a consistent hash for the same region", () => {
      const region = "North America";
      const hash1 = hashRegion(region);
      const hash2 = hashRegion(region);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it("should normalize case and whitespace", () => {
      const hash1 = hashRegion("North America");
      const hash2 = hashRegion("north america");
      const hash3 = hashRegion("  NORTH AMERICA  ");
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it("should produce different hashes for different regions", () => {
      const hash1 = hashRegion("North America");
      const hash2 = hashRegion("Europe");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("parsedPromptKey", () => {
    it("should format the key correctly", () => {
      const hash = "abc123";
      expect(parsedPromptKey(hash)).toBe("parsed_prompt:abc123");
    });
  });

  describe("vacanciesKey", () => {
    it("should format the key correctly", () => {
      const source = "public";
      const regionHash = "def456";
      expect(vacanciesKey(source, regionHash)).toBe("vacancies:public:def456");
    });
  });

  describe("scoreKey", () => {
    it("should format the key correctly", () => {
      const promptHash = "abc123";
      const jobId = "job-789";
      expect(scoreKey(promptHash, jobId)).toBe("scores:abc123:job-789");
    });
  });
});
