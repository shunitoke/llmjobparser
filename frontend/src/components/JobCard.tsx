import { useEffect, useRef, useState } from 'react';
import { Building2, Briefcase, Calendar, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/dates';
import { getJobSourceLabel, getJobSourceBadgeClass } from '@/lib/sources';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
}

export function JobCard({ job }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [animHeight, setAnimHeight] = useState(0);
  const extraRef = useRef<HTMLDivElement>(null);
  const isMatch = job.is_match === true;
  const source = getJobSourceLabel(job);
  const sourceBadgeClass = getJobSourceBadgeClass(job);
  const relativeDate = formatRelativeDate(job.published_at);
  const hasExtra = Boolean(job.match_reason || job.experience || (job.description && expanded));

  useEffect(() => {
    if (hasExtra && extraRef.current) {
      const h = extraRef.current.scrollHeight;
      setAnimHeight(h);
    } else {
      setAnimHeight(0);
    }
  }, [hasExtra, job.match_reason, job.experience, job.description, expanded]);

  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-card transition-all hover:shadow-sm ${
        isMatch ? 'border-l-[3px] border-l-primary border-y border-r border-border' : 'border-border/60'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium leading-relaxed ${sourceBadgeClass}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                {source}
              </span>
              {isMatch && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Подходит
                </span>
              )}
            </div>
            <h3 className="min-w-0 break-words text-base font-semibold leading-snug">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 text-foreground transition-colors hover:text-primary"
              >
                <span className="line-clamp-2">{job.title}</span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              </a>
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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

        <div
          className="transition-all duration-300 ease-out overflow-hidden"
          style={{ maxHeight: animHeight > 0 ? `${animHeight}px` : '0px', opacity: animHeight > 0 ? 1 : 0 }}
        >
          <div ref={extraRef}>
            {job.match_reason && (
              <p className="mt-3 text-sm text-foreground/80">
                <span className="font-medium text-foreground">Почему подходит: </span>
                {job.match_reason}
              </p>
            )}

            {job.experience && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
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
                  className="h-auto px-0 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {expanded ? 'Скрыть описание' : 'Показать описание'}
                  <ChevronDown
                    className={`ml-1 h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </Button>
                {expanded && (
                  <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {job.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
