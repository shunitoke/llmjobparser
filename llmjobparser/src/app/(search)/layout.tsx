import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="container mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold">llmjobparser</h1>
          <nav className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Search</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/saved">Saved</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="container mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
