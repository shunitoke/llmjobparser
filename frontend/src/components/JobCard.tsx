import { useState } from 'react';
import { Building2, Briefcase, Calendar, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/dates';
import { getJobSourceLabel, getJobSourceBadgeClass } from '@/lib/sources';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isMatch = job.is_match === true;
  const source = getJobSourceLabel(job);
  const sourceBadgeClass = getJobSourceBadgeClass(job);
  const relativeDate = formatRelativeDate(job.published_at);

  return (
    <article
      className={`relative overflow-hidden rounded-lg border bg-card p-4 transition-colors ${
        isMatch ? 'border-l-4 border-l-primary border-y border-r border-input' : 'border-input/60 opacity-90'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={sourceBadgeClass}>
              {source}
            </Badge>
            {isMatch && (
              <Badge variant="success" className="text-[10px]">
                Подходит
              </Badge>
            )}
          </div>
          <h3 className="min-w-0 break-words text-lg font-semibold leading-tight">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 hover:underline"
            >
              <span className="line-clamp-2">{job.title}</span>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 opacity-50" />
            </a>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {relativeDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {relativeDate}
              </span>
            )}
            {job.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" aria-hidden="true" />
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {job.location}
              </span>
            )}
            {job.salary && <span className="font-medium text-foreground">{job.salary}</span>}
          </div>
        </div>
      </div>

      {job.match_reason && (
        <p className="mt-3 text-sm text-foreground">
          <span className="font-medium">Почему подходит: </span>
          {job.match_reason}
        </p>
      )}

      {job.experience && (
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Briefcase className="h-3 w-3" aria-hidden="true" />
          {job.experience}
        </div>
      )}

      {job.description && (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className="h-auto px-0 py-1 text-sm text-primary hover:underline"
          >
            {expanded ? 'Скрыть описание' : 'Показать описание'}
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </Button>
          {expanded && (
            <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
              {job.description}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
