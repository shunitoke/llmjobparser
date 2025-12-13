import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type SaveSearchDialogProps = {
  userId: string;
  prompt: string;
  regions: string[];
  categories: string[];
  includePrivate: boolean;
  onSaved?: () => void;
  trigger?: React.ReactNode;
};

export function SaveSearchDialog({
  userId,
  prompt,
  regions,
  categories,
  includePrivate,
  onSaved,
  trigger,
}: SaveSearchDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [scheduleEnabled, setScheduleEnabled] = React.useState(false);
  const [scheduleType, setScheduleType] = React.useState<string>("daily");
  const [customCron, setCustomCron] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter a name for this search");
      return;
    }

    if (scheduleEnabled && scheduleType === "custom" && !customCron.trim()) {
      setError("Please enter a cron expression");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        userId,
        name,
        prompt,
        regions,
        categories,
        includePrivate,
        scheduleEnabled,
      };

      if (scheduleEnabled) {
        payload.scheduleType = scheduleType;
        if (scheduleType === "custom") {
          payload.scheduleCron = customCron;
        }
      }

      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save search");
      }

      setOpen(false);
      setName("");
      setScheduleEnabled(false);
      setScheduleType("daily");
      setCustomCron("");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">Save Search</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save this search and optionally enable notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Search Name</Label>
            <Textarea
              id="name"
              placeholder="e.g., Senior Backend Jobs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="schedule-enabled">Enable Notifications</Label>
              <p className="text-muted-foreground text-xs">
                Get notified when new vacancies match this search
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
          </div>

          {scheduleEnabled ? (
            <div className="space-y-2">
              <Label htmlFor="schedule-type">Notification Frequency</Label>
              <Select value={scheduleType} onValueChange={setScheduleType}>
                <SelectTrigger id="schedule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (9 AM)</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday 9 AM)</SelectItem>
                  <SelectItem value="custom">Custom (cron)</SelectItem>
                </SelectContent>
              </Select>

              {scheduleType === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-cron">Cron Expression</Label>
                  <Textarea
                    id="custom-cron"
                    placeholder="0 9 * * *"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    rows={2}
                  />
                  <p className="text-muted-foreground text-xs">
                    Use standard cron format (e.g., &quot;0 9 * * *&quot; for
                    daily at 9 AM)
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
