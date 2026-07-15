import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CandidateJob } from '../types';
import { CandidateCard } from './CandidateCard';

interface CandidateListProps {
  items: CandidateJob[];
  total: number;
  offset: number;
  limit: number;
  isVisible: boolean;
  onVisibilityChange: () => void;
  onLoad: (offset: number) => void;
}

export function CandidateList({
  items,
  total,
  offset,
  limit,
  isVisible,
  onVisibilityChange,
  onLoad,
}: CandidateListProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(isVisible);
  }, [isVisible]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onVisibilityChange}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-muted-foreground" aria-hidden="true">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium">Найденные вакансии</h3>
            {total > 0 && <p className="text-xs text-muted-foreground">{total} вакансий</p>}
          </div>
        </div>
        <span className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {isVisible ? 'Скрыть' : 'Показать'}
        </span>
      </button>

      <div
        className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          maxHeight: open ? `${Math.min(items.length * 120 + 120, 800)}px` : '0px',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
        }}
      >
        <div className="border-t p-4">
          <div className="space-y-2">
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
                  disabled={offset <= 0}
                >
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onLoad(offset + limit)}
                  disabled={offset + limit >= total}
                >
                  Вперёд
                </Button>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-1 lg:max-h-96">
              {items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Пока вакансий нет</p>
              ) : (
                items.map((c) => (
                  <div key={c.id}>
                    <CandidateCard item={c} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
