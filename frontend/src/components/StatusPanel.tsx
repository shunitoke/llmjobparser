import { Check, Loader2 } from 'lucide-react';
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
    <section aria-live="polite" aria-atomic="true" className="mb-8 animate-fade-in">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{statusLabel(status.status)}</p>
            {status.current_source && (
              <p className="text-xs text-muted-foreground">Источник: {status.current_source}</p>
            )}
            {status.current_model && status.current_model !== 'GigaChat' && (
              <p className="text-xs text-muted-foreground">Модель: {status.current_model}</p>
            )}
          </div>
        </div>

        <ol aria-label="Этапы поиска" className="mt-5 flex items-center gap-0">
          {STEPS.map((step, index) => {
            const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending';
            return (
              <li key={step.key} className="flex items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all ${
                      state === 'done'
                        ? 'bg-primary text-primary-foreground'
                        : state === 'active'
                        ? 'border-2 border-primary bg-background text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    aria-current={state === 'active' ? 'step' : undefined}
                  >
                    {state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span
                    className={`text-[9px] font-medium uppercase tracking-wider ${
                      state === 'active' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <span
                    className={`mx-1 h-px flex-1 min-w-[1.25rem] ${
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
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{progress.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {progress.value} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${Math.min((progress.value / progress.total) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {status.generated_queries && (
          <div className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Запросы: </span>
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
    pending: 'Ожидание',
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
      return { label: 'Детали загружены', value: status.scraped_count, total: Math.max(status.selected_count, 1) };
    case 'analyzing':
      return { label: 'Проанализировано', value: status.analyzed_jobs, total: Math.max(status.total_jobs, 1) };
    default:
      return { label: '', value: 0, total: 0 };
  }
}
