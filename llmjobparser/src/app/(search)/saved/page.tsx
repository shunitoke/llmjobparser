import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { SavedSearchesClient } from "./saved-searches-client";

export default function SavedSearchesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Saved Searches
        </h2>
        <p className="text-muted-foreground text-sm">
          Manage your saved searches and notification schedules.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Saved Searches</CardTitle>
        </CardHeader>
        <CardContent>
          <SavedSearchesClient userId="dev-user-id" />
        </CardContent>
      </Card>
    </div>
  );
}
