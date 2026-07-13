import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CandidateJob } from '../types';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
  items: CandidateJob[];
  total: number;
  offset: number;
  limit: number;
  readyOnly: boolean | null;
  loading: boolean;
  isVisible: boolean;
  onVisibilityChange: () => void;
  onReadyOnlyChange: (readyOnly: boolean | null) => void;
  onLoad: (offset: number, readyOnly: boolean | null) => void;
}

export function CandidateList({
  items,
  total,
  offset,
  limit,
  readyOnly,
  loading,
  isVisible,
  onVisibilityChange,
  onReadyOnlyChange,
  onLoad,
}: CandidateListProps) {
  return (
    <details
      className="rounded-lg border bg-card text-card-foreground"
      open={isVisible}
      onToggle={(e) => {
        const nextOpen = (e.target as HTMLDetailsElement).open;
        if (nextOpen !== isVisible) {
          onVisibilityChange();
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 marker:hidden">
        <div>
          <h3 className="text-base font-semibold">Посмотреть найденные вакансии</h3>
          <p className="text-sm text-muted-foreground">Предварительный список до финального отбора</p>
        </div>
        <span className="pointer-events-none rounded-md border border-input bg-background px-3 py-1 text-xs font-medium" aria-hidden="true">
          {isVisible ? 'Скрыть' : 'Показать'}
        </span>
      </summary>
      <div className="border-t p-4 pt-0">
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Готовность:</span>
            <Button
              type="button"
              variant={readyOnly === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onReadyOnlyChange(null);
                onLoad(0, null);
              }}
            >
              Все
            </Button>
            <Button
              type="button"
              variant={readyOnly === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onReadyOnlyChange(true);
                onLoad(0, true);
              }}
            >
              Готовые
            </Button>
            <Button
              type="button"
              variant={readyOnly === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onReadyOnlyChange(false);
                onLoad(0, false);
              }}
            >
              В работе
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">Список кандидатов</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onLoad(offset, readyOnly)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Обновить'}
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {total > 0 ? (
                <span>
                  Показано {offset + 1}–{Math.min(offset + limit, total)} из {total}
                </span>
              ) : (
                <span>Пока вакансий нет</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLoad(Math.max(0, offset - limit), readyOnly)}
                disabled={loading || offset <= 0}
              >
                Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onLoad(offset + limit, readyOnly)}
                disabled={loading || offset + limit >= total}
              >
                Вперёд
              </Button>
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1 lg:max-h-96">
            {loading && items.length === 0 && <div className="text-sm text-muted-foreground">Загружаем…</div>}
            {!loading && items.length === 0 && <div className="text-sm text-muted-foreground">Пока вакансий нет</div>}
            {items.map((c) => (
              <CandidateCard key={c.id} item={c} />
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
