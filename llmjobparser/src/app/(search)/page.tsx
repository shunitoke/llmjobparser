import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <div className="bg-muted/30 min-h-screen">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            llmjobparser
          </h1>
          <p className="text-muted-foreground text-sm">
            Describe the role you want. We&#39;ll return placeholder results for
            now.
          </p>
        </header>
        <SearchClient />
      </main>
    </div>
  );
}
