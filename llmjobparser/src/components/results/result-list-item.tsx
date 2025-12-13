import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Vacancy } from "@/lib/types";

export function ResultListItem({ vacancy }: { vacancy: Vacancy }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{vacancy.title}</CardTitle>
            <CardDescription>
              {vacancy.company} • {vacancy.location}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {vacancy.badges.map((b) => (
              <Badge key={b} variant="secondary">
                {b}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{vacancy.summary}</p>
      </CardContent>
    </Card>
  );
}
