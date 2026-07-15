import { Job } from '../types';
import { JobCard } from './JobCard';

export type ResultsTab = 'matched' | 'all' | 'unmatched';
export type ResultsSort = 'relevance' | 'date' | 'source' | 'location';

interface ResultsListProps {
  isCompleted: boolean;
  matchedJobs: Job[];
  unmatchedJobs: Job[];
  allJobs: Job[];
  sort: ResultsSort;
  selectedTab: ResultsTab;
  onSortChange: (value: ResultsSort) => void;
  onTabChange: (value: ResultsTab) => void;
}

const SORT_OPTIONS: Array<{ value: ResultsSort; label: string }> = [
  { value: 'relevance', label: 'По релевантности' },
  { value: 'date', label: 'По дате' },
  { value: 'source', label: 'По источнику' },
  { value: 'location', label: 'По адресу' },
];

const TABS: Array<{ value: ResultsTab; label: string }> = [
  { value: 'matched', label: 'Подходят' },
  { value: 'all', label: 'Все' },
  { value: 'unmatched', label: 'Не подходят' },
];

export function ResultsList({
  isCompleted,
  matchedJobs,
  unmatchedJobs,
  allJobs,
  sort,
  selectedTab,
  onSortChange,
  onTabChange,
}: ResultsListProps) {
  const visibleJobs = selectedTab === 'matched' ? matchedJobs : selectedTab === 'unmatched' ? unmatchedJobs : allJobs;
  const hasResults = matchedJobs.length > 0 || unmatchedJobs.length > 0;
  const total = matchedJobs.length + unmatchedJobs.length;

  return (
    <section aria-label="Результаты поиска">
      {isCompleted && hasResults && (
        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
          Найдено <strong className="text-foreground">{matchedJobs.length}</strong> подходящих вакансий из {total}
        </p>
      )}

      {isCompleted && matchedJobs.length === 0 && unmatchedJobs.length === 0 && (
        <div className="mb-8 rounded-xl border bg-card p-8 text-center">
          <p className="font-medium text-foreground">Пока вакансий нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Попробуйте уточнить запрос: роль, формат работы, зарплату или город.
          </p>
        </div>
      )}

      {hasResults && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Фильтр результатов"
              className="inline-flex overflow-hidden rounded-lg border bg-card p-0.5"
            >
              {TABS.map((tab) => {
                const active = selectedTab === tab.value;
                const count =
                  tab.value === 'matched' ? matchedJobs.length : tab.value === 'unmatched' ? unmatchedJobs.length : total;
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => onTabChange(tab.value)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="result-sort" className="text-xs text-muted-foreground">
                Сортировка:
              </label>
              <select
                id="result-sort"
                name="result-sort"
                value={sort}
                onChange={(e) => onSortChange(e.target.value as ResultsSort)}
                className="h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3" role="tabpanel" aria-label={TABS.find((t) => t.value === selectedTab)?.label}>
            {visibleJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет вакансий в этой категории.</p>
            ) : (
              visibleJobs.map((job, i) => (
                <div key={job.id} className="animate-pop-in" style={{ animationDelay: `${i * 20}ms` }}>
                  <JobCard job={job} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
