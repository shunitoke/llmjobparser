import { Building2, Calendar, ExternalLink, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CandidateJob } from '../types';

interface CandidateCardProps {
  item: CandidateJob;
}

export function CandidateCard({ item }: CandidateCardProps) {
  const createdLabel = formatDateTime(item.created_at ?? null);
  const source = getCandidateSource(item);

  return (
    <article className="rounded-md border border-input/60 bg-background/50 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/50">
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
            {createdLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {createdLabel}
              </span>
            )}
            {item.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {item.company}
              </span>
            )}
            {item.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
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

function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function getCandidateSource(item: CandidateJob) {
  const s = (item.source || '').toLowerCase();
  if (s === 'hh') return 'HH.ru';
  if (s === 'rabota') return 'Rabota.ru';
  if (s === 'superjob') return 'SuperJob';
  if (s === 'telegram') return 'Telegram';
  if (s === 'remoteok') return 'RemoteOK';
  if (s === 'wwr') return 'We Work Remotely';
  if (s === '4dayweek') return '4DayWeek';
  if (s === 'djinni') return 'Djinni';
  const id = (item.hh_id || '').toLowerCase();
  if (id.startsWith('hh:')) return 'HH.ru';
  if (id.startsWith('rabota:')) return 'Rabota.ru';
  if (id.startsWith('sj:')) return 'SuperJob';
  if (id.startsWith('tg:')) return 'Telegram';
  if (id.startsWith('remoteok:')) return 'RemoteOK';
  if (id.startsWith('wwr:')) return 'We Work Remotely';
  if (id.startsWith('4dw:')) return '4DayWeek';
  if (id.startsWith('djinni:')) return 'Djinni';
  return 'Источник';
}
