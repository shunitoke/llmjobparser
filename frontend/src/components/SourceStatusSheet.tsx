import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSourceHealth, SourceHealth } from '../api';
import { SOURCE_KEY_LABELS, SOURCE_ORDER } from '@/lib/sources';

interface SourceStatusSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SourceStatusSheet({ open, onClose }: SourceStatusSheetProps) {
  const [health, setHealth] = useState<Record<string, SourceHealth> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getSourceHealth()
      .then(setHealth)
      .catch(() => setError('Не удалось загрузить статус источников'))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const entries = health
    ? Object.entries(health).sort(([a], [b]) => {
        const ai = SOURCE_ORDER.indexOf(a);
        const bi = SOURCE_ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b, 'ru');
      })
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-status-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="h-full w-full max-w-sm overflow-y-auto border-l bg-card p-6 text-card-foreground shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="source-status-title" className="text-lg font-semibold">
            Источники
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Состояние подключения к источникам вакансий.
        </p>

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаем…
          </div>
        )}

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {!loading && !error && entries.length === 0 && (
          <p className="mt-6 text-sm text-muted-foreground">Нет данных об источниках.</p>
        )}

        {!loading && entries.length > 0 && (
          <ul className="mt-6 space-y-2" aria-label="Статус источников">
            {entries.map(([name, value]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
              >
                <span className="text-sm font-medium">{SOURCE_KEY_LABELS[name] ?? name}</span>
                <HealthBadge value={value} />
              </li>
            ))}
          </ul>
        )}

        {!loading && health?.superjob === 'blocked' && (
          <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            SuperJob заблокировал автоматические запросы (капча). Используйте{' '}
            <a
              href="https://www.superjob.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              superjob.ru
            </a>{' '}
            напрямую для поиска вакансий.
          </div>
        )}

        <div className="mt-6 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Глобальные источники и Telegram в РФ могут требовать VPN.
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ value }: { value: SourceHealth }) {
  const config: Record<
    SourceHealth,
    { label: string; className: string }
  > = {
    ok: {
      label: 'OK',
      className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
    },
    slow: {
      label: 'Медленно',
      className: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
    },
    blocked: {
      label: 'Блок',
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    unknown: {
      label: 'Неизвестно',
      className: 'bg-muted text-muted-foreground border-input',
    },
  };
  const { label, className } = config[value] ?? config.unknown;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
