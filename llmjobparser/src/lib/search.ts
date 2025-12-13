import { z } from "zod";

import type { SearchInput, Vacancy } from "@/lib/types";

export const searchInputSchema = z.object({
  prompt: z.string().min(5, "Please enter at least 5 characters.").max(2000),
  regions: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  includePrivate: z.boolean().default(false),
});

export async function searchVacancies(input: SearchInput): Promise<Vacancy[]> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Search failed (${res.status})`);
  }

  const json = (await res.json()) as unknown;
  const parsed = z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          company: z.string(),
          location: z.string(),
          summary: z.string(),
          badges: z.array(z.string()),
        }),
      ),
    })
    .parse(json);

  return parsed.items;
}
