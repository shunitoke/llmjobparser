"use client";

import { SavedSearchesList } from "@/components/saved-searches/saved-searches-list";

type SavedSearchesClientProps = {
  userId: string;
};

export function SavedSearchesClient({ userId }: SavedSearchesClientProps) {
  return <SavedSearchesList userId={userId} />;
}
