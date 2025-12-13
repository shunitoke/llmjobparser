import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Job Search</h2>
        <p className="text-muted-foreground text-sm">
          Describe the role you want. We&#39;ll return placeholder results for
          now.
        </p>
      </header>
      <SearchClient />
    </div>
  );
}
