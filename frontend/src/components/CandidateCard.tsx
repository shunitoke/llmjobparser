import { Building2, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate } from '@/lib/dates';
import { getJobSource, getJobSourceBadgeClass } from '@/lib/sources';
import { CandidateJob } from '../types';

interface CandidateCardProps {
  item: CandidateJob;
}

export function CandidateCard({ item }: CandidateCardProps) {
  const relativeDate = formatRelativeDate(item.created_at);
  const source = getJobSource(item);
  const sourceBadgeClass = getJobSourceBadgeClass(item);

  return (
    <article className="rounded-md border border-input/60 bg-background/50 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={sourceBadgeClass}>
              {source}
            </Badge>
            {item.selected && <Badge variant="success">Отобрана</Badge>}
          </div>
          <h4 className="min-w-0 break-words font-medium leading-snug">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              <span className="line-clamp-2">{item.title || 'Без названия'}</span>
              <ExternalLink className="h-4 w-4 shrink-0 opacity-50" />
            </a>
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {relativeDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {relativeDate}
              </span>
            )}
            {item.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" aria-hidden="true" />
                {item.company}
              </span>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {item.location}
              </span>
            )}
            {item.salary && <span className="font-medium text-foreground">{item.salary}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
