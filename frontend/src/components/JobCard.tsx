import { Building2, Briefcase, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Job } from '../types';

interface JobCardProps {
  job: Job;
  isMatch: boolean;
}

export function JobCard({ job, isMatch }: JobCardProps) {
  const publishedLabel = formatDate(job.published_at ?? null);
  const source = getJobSource(job);

  return (
    <article className={`rounded-lg border p-4 transition-colors ${isMatch ? 'border-input bg-card' : 'border-input/60 bg-muted/20 opacity-80'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="bg-background/50">
              {source}
            </Badge>
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
            {publishedLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {publishedLabel}
              </span>
            )}
            {job.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            {job.salary && <span className="font-medium text-foreground">{job.salary}</span>}
          </div>
        </div>
      </div>

      {job.match_reason && (
        <p className={`mt-3 text-sm ${isMatch ? 'text-foreground' : 'text-muted-foreground'}`}>
          {job.match_reason}
        </p>
      )}
      {job.experience && (
        <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Briefcase className="h-3 w-3" />
          {job.experience}
        </div>
      )}
      {job.description && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary hover:underline">
            Показать описание
          </summary>
          <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm text-muted-foreground">
            {job.description}
          </p>
        </details>
      )}
    </article>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function getJobSource(job: Job) {
  const id = (job.hh_id || '').toLowerCase();
  if (id.startsWith('hh:')) return 'HH.ru';
  if (id.startsWith('rabota:')) return 'Rabota.ru';
  if (id.startsWith('sj:')) return 'SuperJob';
  if (id.startsWith('tg:')) return 'Telegram';
  if (id.startsWith('remoteok:')) return 'RemoteOK';
  if (id.startsWith('wwr:')) return 'We Work Remotely';
  if (id.startsWith('4dw:')) return '4DayWeek';
  if (id.startsWith('djinni:')) return 'Djinni';
  const url = (job.url || '').toLowerCase();
  if (url.includes('rabota.ru')) return 'Rabota.ru';
  if (url.includes('hh.ru')) return 'HH.ru';
  if (url.includes('superjob.ru')) return 'SuperJob';
  if (url.includes('t.me/')) return 'Telegram';
  if (url.includes('remoteok.com')) return 'RemoteOK';
  if (url.includes('weworkremotely.com')) return 'We Work Remotely';
  if (url.includes('4dayweek.io')) return '4DayWeek';
  if (url.includes('djinni.co')) return 'Djinni';
  return 'Источник';
}
