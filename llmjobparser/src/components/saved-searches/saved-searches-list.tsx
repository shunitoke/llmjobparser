import * as React from "react";
import { Bell, BellOff, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SavedSearch = {
  id: string;
  name: string;
  prompt: string;
  regions: string[];
  categories: string[];
  scheduleEnabled: boolean;
  scheduleType: string | null;
  scheduleCron: string | null;
  createdAt: string;
};

type SavedSearchesListProps = {
  userId: string;
  onDelete?: () => void;
  onToggleSchedule?: () => void;
};

export function SavedSearchesList({
  userId,
  onDelete,
  onToggleSchedule,
}: SavedSearchesListProps) {
  const [searches, setSearches] = React.useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const fetchSearches = React.useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/saved-searches?userId=${encodeURIComponent(userId)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch saved searches");
      }

      const data = await response.json();
      setSearches(data.searches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    fetchSearches();
  }, [fetchSearches]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this saved search?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/saved-searches/${id}?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete saved search");
      }

      await fetchSearches();
      onDelete?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete search");
    }
  }

  async function handleToggleSchedule(search: SavedSearch) {
    try {
      const response = await fetch(`/api/saved-searches/${search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          scheduleEnabled: !search.scheduleEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update schedule");
      }

      await fetchSearches();
      onToggleSchedule?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update schedule");
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (error) {
    return <p className="text-destructive text-sm">{error}</p>;
  }

  if (searches.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No saved searches yet. Save a search to get started.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {searches.map((search) => (
        <Card key={search.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{search.name}</h3>
                  {search.scheduleEnabled ? (
                    <Badge variant="default">
                      {search.scheduleType === "daily"
                        ? "Daily"
                        : search.scheduleType === "weekly"
                          ? "Weekly"
                          : "Custom"}
                    </Badge>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-sm">{search.prompt}</p>

                <div className="flex flex-wrap gap-2">
                  {search.regions && search.regions.length > 0 ? (
                    <div className="flex gap-1">
                      {search.regions.map((region) => (
                        <Badge key={region} variant="outline">
                          {region}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {search.categories && search.categories.length > 0 ? (
                    <div className="flex gap-1">
                      {search.categories.map((category) => (
                        <Badge key={category} variant="secondary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleSchedule(search)}
                  title={
                    search.scheduleEnabled
                      ? "Disable notifications"
                      : "Enable notifications"
                  }
                >
                  {search.scheduleEnabled ? (
                    <Bell className="h-4 w-4" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(search.id)}
                  title="Delete search"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
