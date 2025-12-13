"use client";

import * as React from "react";

import { ResultListItem } from "@/components/results/result-list-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSearch } from "@/hooks/use-search";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { searchInputSchema } from "@/lib/search";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<"prompt" | "regions" | "categories", string>>;

export function SearchClient() {
  const [prompt, setPrompt] = React.useState("");
  const [regions, setRegions] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);
  const [includePrivate, setIncludePrivate] = React.useState(false);

  const [showAdmin, setShowAdmin] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const { results, isLoading, error, hasSearched, runSearch } = useSearch();

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "1") setShowAdmin(true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        setShowAdmin((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const regionOptions = React.useMemo(
    () => REGIONS.map((r) => ({ value: r, label: r })),
    [],
  );
  const categoryOptions = React.useMemo(
    () => CATEGORIES.map((c) => ({ value: c, label: c })),
    [],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = searchInputSchema.safeParse({
      prompt,
      regions,
      categories,
      includePrivate,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "prompt" || field === "regions" || field === "categories") {
          nextErrors[field] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    await runSearch(parsed.data);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Example: Senior backend engineer (Node/TS), remote in Europe, fintech, strong on Postgres and AWS."
                className={cn(fieldErrors.prompt && "border-destructive")}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Keep it short and specific; minimum 5 characters.
                </p>
                <p className="text-xs text-muted-foreground">
                  {prompt.length}/2000
                </p>
              </div>
              {fieldErrors.prompt ? (
                <p className="text-sm text-destructive">{fieldErrors.prompt}</p>
              ) : null}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Regions</Label>
                <MultiSelect
                  options={regionOptions}
                  value={regions}
                  onChange={setRegions}
                  placeholder="Select regions"
                />
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <MultiSelect
                  options={categoryOptions}
                  value={categories}
                  onChange={setCategories}
                  placeholder="Select categories"
                />
              </div>
            </div>

            <div className={cn("flex items-center gap-3", !showAdmin && "hidden")}>
              <Switch
                id="includePrivate"
                checked={includePrivate}
                onCheckedChange={setIncludePrivate}
              />
              <Label htmlFor="includePrivate">Include private scrapers</Label>
              <Badge variant="outline" className="ml-auto">
                admin
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Searching…" : "Search"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Results</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : null}

          {!error && hasSearched && !isLoading && results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vacancies found. Try a different prompt.
            </p>
          ) : null}

          {!error && results.length > 0 ? (
            <div className="space-y-4">
              {results.map((v) => (
                <ResultListItem key={v.id} vacancy={v} />
              ))}
            </div>
          ) : null}

          {!hasSearched ? (
            <p className="text-sm text-muted-foreground">
              Submit the form to see placeholder vacancies.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
