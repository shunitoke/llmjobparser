import { memo } from 'react';
import { Building2, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate } from '@/lib/dates';
import { getJobSource, getJobSourceBadgeClass } from '@/lib/sources';
import { CandidateJob } from '../types';

interface CandidateCardProps {
  item: CandidateJob;
}

export const CandidateCard = memo(function CandidateCard({ item }: CandidateCardProps) {
  const relativeDate = formatRelativeDate(item.created_at);
  const source = getJobSource(item);
  const sourceBadgeClass = getJobSourceBadgeClass(item);

  return (
    <article className="rounded-lg border border-border/60 bg-background/50 p-3 transition-colors hover:bg-accent/30">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium leading-relaxed ${sourceBadgeClass}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
              {source}
            </span>
            {item.selected && <Badge variant="success" className="text-[10px]">Отобрана</Badge>}
          </div>
          <h4 className="min-w-0 break-words text-sm font-medium leading-snug">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
            >
              <span className="line-clamp-2">{item.title || 'Без названия'}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            </a>
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
});