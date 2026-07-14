import { Loader2 } from 'lucide-react';
import { SearchStatus } from '../types';

interface StatusPanelProps {
  status: SearchStatus;
}

const STEPS: Array<{ key: string; label: string }> = [
  { key: 'generating_queries', label: 'Запросы' },
  { key: 'collecting_candidates', label: 'Сбор' },
  { key: 'selecting', label: 'Отбор' },
  { key: 'scraping_details', label: 'Детали' },
  { key: 'analyzing', label: 'Анализ' },
  { key: 'completed', label: 'Готово' },
];

export function StatusPanel({ status }: StatusPanelProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === status.status);
  const activeIndex = currentIndex >= 0 ? currentIndex : STEPS.length - 1;

  const progress = computeProgress(status);

  return (
    <section aria-live="polite" aria-atomic="true" className="mb-8">
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">{statusLabel(status.status)}</p>
            {status.current_source && (
              <p className="text-sm text-muted-foreground">Источник: {status.current_source}</p>
            )}
            {status.current_query && (
              <p className="text-sm text-muted-foreground truncate">Поиск: «{status.current_query}»</p>
            )}
          </div>
        </div>

        <ol
          aria-label="Этапы поиска"
          className="mt-5 flex items-center justify-between gap-1 overflow-x-auto"
        >
          {STEPS.map((step, index) => {
            const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
            return (
              <li key={step.key} className="flex min-w-0 flex-1 items-center last:flex-none">
                <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      state === 'done'
                        ? 'bg-primary text-primary-foreground'
                        : state === 'active'
                        ? 'border-2 border-primary bg-background text-primary'
                        : 'border border-input bg-muted text-muted-foreground'
                    }`}
                    aria-current={state === 'active' ? 'step' : undefined}
                  >
                    {state === 'done' ? '✓' : index + 1}
                  </span>
                  <span
                    className={`hidden text-[10px] uppercase tracking-wide sm:inline ${
                      state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <span
                    className={`mx-1 h-px flex-1 min-w-[1rem] ${
                      index < activeIndex ? 'bg-primary' : 'bg-border'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>

        {progress.total > 0 && (
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{progress.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {progress.value} / {progress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min((progress.value / progress.total) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {status.generated_queries && (
          <div className="mt-4 text-xs text-muted-foreground">
            <span className="font-medium">Запросы: </span>
            {(() => {
              try {
                return JSON.parse(status.generated_queries).join(', ');
              } catch {
                return status.generated_queries;
              }
            })()}
          </div>
        )}
      </div>
    </section>
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    generating_queries: 'Формируем поисковые запросы',
    collecting_candidates: 'Собираем вакансии',
    selecting: 'Отбираем релевантное',
    scraping_details: 'Читаем детали вакансий',
    analyzing: 'Сверяем вакансии с вашим запросом',
    completed: 'Поиск завершён',
    cancelled: 'Поиск отменён',
    failed: 'Поиск завершился с ошибкой',
  };
  return labels[status] ?? status;
}

function computeProgress(status: SearchStatus): { label: string; value: number; total: number } {
  switch (status.status) {
    case 'collecting_candidates':
      return { label: 'Собрано вакансий', value: status.candidates_count, total: Math.max(status.candidates_count, 1) };
    case 'selecting':
      return { label: 'Отобрано', value: status.selected_count, total: Math.max(status.candidates_count, 1) };
    case 'scraping_details':
      return {
        label: 'Детали загружены',
        value: status.scraped_count,
        total: Math.max(status.selected_count, 1),
      };
    case 'analyzing':
      return { label: 'Проанализировано', value: status.analyzed_jobs, total: Math.max(status.total_jobs, 1) };
    default:
      return { label: '', value: 0, total: 0 };
  }
}
