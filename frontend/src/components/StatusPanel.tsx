import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchStatus } from '../types';

interface StatusPanelProps {
  status: SearchStatus;
}

const statusCopy: Record<string, string> = {
  generating_queries: 'Формируем поисковые запросы',
  collecting_candidates: 'Собираем вакансии',
  selecting: 'Отбираем релевантное',
  scraping_details: 'Читаем детали вакансий',
  analyzing: 'Сверяем вакансии с вашим запросом',
};

export function StatusPanel({ status }: StatusPanelProps) {
  const statusLabel = statusCopy[status.status] ?? status.status;

  return (
    <section aria-live="polite" aria-atomic="true">
      <Card className="mb-8">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium">{statusLabel}</p>
              {status.current_source && (
                <p className="text-sm text-muted-foreground">Источник: {status.current_source}</p>
              )}
              {status.current_query && (
                <p className="text-sm text-muted-foreground">Поиск: «{status.current_query}»</p>
              )}
            </div>
          </div>

          {status.status === 'collecting_candidates' && status.candidates_count > 0 && (
            <Progress label="Собрано вакансий" value={status.candidates_count} />
          )}
          {status.status === 'selecting' && status.selected_count > 0 && (
            <Progress label="Отобрано" value={status.selected_count} />
          )}
          {status.status === 'scraping_details' && status.scraped_count > 0 && (
            <Progress
              label="Детали загружены"
              value={status.scraped_count}
              total={status.selected_count || undefined}
            />
          )}
          {status.status === 'analyzing' && status.total_jobs > 0 && (
            <>
              <Progress label="Проанализировано" value={status.analyzed_jobs} total={status.total_jobs} />
              <p className="text-sm text-muted-foreground">Подходит: {status.matched_jobs}</p>
            </>
          )}

          {status.generated_queries && (
            <div className="text-xs text-muted-foreground">
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
        </CardContent>
      </Card>
    </section>
  );
}

interface ProgressProps {
  label: string;
  value: number;
  total?: number;
}

function Progress({ label, value, total }: ProgressProps) {
  const width = total && total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {total ? ` / ${total}` : ''}
        </span>
      </div>
      {total ? (
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${width}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
