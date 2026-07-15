import { Button } from '@/components/ui/button';
import { CandidateJob } from '../types';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
  items: CandidateJob[];
  total: number;
  offset: number;
  limit: number;
  loading: boolean;
  isVisible: boolean;
  onVisibilityChange: () => void;
  onLoad: (offset: number) => void;
}

export function CandidateList({
  items,
  total,
  offset,
  limit,
  loading,
  isVisible,
  onVisibilityChange,
  onLoad,
}: CandidateListProps) {
  return (
    <details
      className="rounded-xl border bg-card"
      open={isVisible}
      onToggle={(e) => {
        const nextOpen = (e.target as HTMLDetailsElement).open;
        if (nextOpen !== isVisible) {
          onVisibilityChange();
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 marker:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium">Найденные вакансии</h3>
            <p className="text-xs text-muted-foreground">Предварительный список до финального отбора</p>
          </div>
        </div>
        <span className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {isVisible ? 'Скрыть' : 'Показать'}
        </span>
      </summary>
      <div className="border-t p-4">
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {total > 0 && (
                <span>
                  Показано {offset + 1}–{Math.min(offset + limit, total)} из {total}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLoad(Math.max(0, offset - limit))}
                disabled={loading || offset <= 0}
              >
                Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLoad(offset + limit)}
                disabled={loading || offset + limit >= total}
              >
                Вперёд
              </Button>
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1 lg:max-h-96">
            {loading && items.length === 0 && <p className="text-xs text-muted-foreground">Загружаем…</p>}
            {!loading && total === 0 && items.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Пока вакансий нет</p>
            )}
            {items.map((c) => (
              <CandidateCard key={c.id} item={c} />
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
