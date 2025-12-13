"use client";

import { useCallback, useState } from "react";

import { searchVacancies } from "@/lib/search";
import type { SearchInput, Vacancy } from "@/lib/types";

export function useSearch() {
  const [results, setResults] = useState<Vacancy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async (input: SearchInput) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setResults([]);

    try {
      const items = await searchVacancies(input);
      setResults(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    results,
    isLoading,
    error,
    hasSearched,
    runSearch,
  };
}
