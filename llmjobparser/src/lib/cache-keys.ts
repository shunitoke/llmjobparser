import { createHash } from "crypto";

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

export function hashRegion(region: string): string {
  return createHash("sha256")
    .update(region.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export function parsedPromptKey(promptHash: string): string {
  return `parsed_prompt:${promptHash}`;
}

export function vacanciesKey(source: string, regionHash: string): string {
  return `vacancies:${source}:${regionHash}`;
}

export function scoreKey(promptHash: string, jobId: string): string {
  return `scores:${promptHash}:${jobId}`;
}
