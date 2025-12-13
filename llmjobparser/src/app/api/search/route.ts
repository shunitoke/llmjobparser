import { NextResponse } from "next/server";

import { searchInputSchema } from "@/lib/search";

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

  const { prompt, regions, categories, includePrivate } = parsed.data;

  await new Promise((r) => setTimeout(r, 500));

  const trimmed = prompt.trim().toLowerCase();
  if (trimmed.includes("no results") || trimmed.includes("empty")) {
    return NextResponse.json({ items: [] });
  }

  const badges = [
    ...new Set([
      ...regions.slice(0, 2),
      ...categories.slice(0, 2),
      includePrivate ? "Private" : null,
    ]),
  ].filter((b): b is string => Boolean(b));

  const items = [
    {
      id: crypto.randomUUID(),
      title: "Senior Backend Engineer",
      company: "Example Corp",
      location: regions[0] ?? "Remote",
      summary:
        "Mock vacancy returned by /api/search. This will be replaced with real scraping + LLM parsing.",
      badges: badges.length ? badges : ["Mock"],
    },
    {
      id: crypto.randomUUID(),
      title: "Full-Stack Engineer",
      company: "Placeholder Labs",
      location: regions[1] ?? regions[0] ?? "Remote",
      summary: "Another placeholder result based on your prompt.",
      badges: badges.length ? badges : ["Mock"],
    },
    {
      id: crypto.randomUUID(),
      title: "Data Engineer",
      company: "Acme Data",
      location: "Hybrid",
      summary:
        "Use the form to refine the prompt; this API currently returns fixed demo data.",
      badges: badges.length ? badges : ["Mock"],
    },
  ];

  return NextResponse.json({ items });
}
