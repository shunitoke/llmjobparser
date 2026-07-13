import { Job } from '../types';
import { JobCard } from './JobCard';

type MatchedSort = 'date' | 'source' | 'location';

interface ResultsListProps {
  isCompleted: boolean;
  matchedJobs: Job[];
  unmatchedJobs: Job[];
  sortedMatchedJobs: Job[];
  sortedUnmatchedJobs: Job[];
  matchedSort: MatchedSort;
  onMatchedSortChange: (value: MatchedSort) => void;
}

export function ResultsList({
  isCompleted,
  matchedJobs,
  unmatchedJobs,
  sortedMatchedJobs,
  sortedUnmatchedJobs,
  matchedSort,
  onMatchedSortChange,
}: ResultsListProps) {
  const total = matchedJobs.length + unmatchedJobs.length;
  const hasResults = matchedJobs.length > 0 || unmatchedJobs.length > 0;

  return (
    <>
      {isCompleted && hasResults && (
        <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
          Найдено <strong className="text-foreground">{matchedJobs.length}</strong> подходящих вакансий из{' '}
          {total}
        </p>
      )}

      {isCompleted && matchedJobs.length === 0 && unmatchedJobs.length === 0 && (
        <div className="mb-8 rounded-lg border border-input/60 bg-muted/40 p-6 text-center">
          <p className="text-foreground">Пока вакансий нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Попробуйте уточнить запрос: роль, формат работы, зарплату или город.
          </p>
        </div>
      )}

      {matchedJobs.length > 0 && (
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Подходящие вакансии</h2>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="result-sort" className="text-muted-foreground">
                Сортировка:
              </label>
              <select
                id="result-sort"
                name="result-sort"
                value={matchedSort}
                onChange={(e) => onMatchedSortChange(e.target.value as MatchedSort)}
                className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="date">По дате</option>
                <option value="source">По источнику</option>
                <option value="location">По адресу</option>
              </select>
            </div>
          </div>
          {sortedMatchedJobs.map((job) => (
            <JobCard key={job.id} job={job} isMatch={true} />
          ))}
        </div>
      )}

      {unmatchedJobs.length > 0 && (
        <details className="group rounded-lg border border-input/60 bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 marker:hidden">
            <h2 className="text-base font-semibold text-muted-foreground">
              Не подошли ({unmatchedJobs.length})
            </h2>
            <span className="text-xs text-muted-foreground group-open:hidden">Показать</span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">Скрыть</span>
          </summary>
          <div className="space-y-4 border-t p-4 pt-0">
            {sortedUnmatchedJobs.map((job) => (
              <JobCard key={job.id} job={job} isMatch={false} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
