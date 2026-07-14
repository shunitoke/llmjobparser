import { useState } from 'react';
import { ChevronDown, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { HH_CATEGORIES, RU_LOCATION_SUGGESTIONS } from '@/lib/locationSuggestions';

type SearchMode = 'ru' | 'global' | 'telegram';

interface SearchFormProps {
  prompt: string;
  cityPreset: string;
  searchMode: SearchMode;
  selectedCategories: string[];
  isLoading: boolean;
  canCancel: boolean;
  cancelDisabled: boolean;
  onPromptChange: (value: string) => void;
  onCityPresetChange: (value: string) => void;
  onSearchModeChange: (value: SearchMode) => void;
  onClearCategories: () => void;
  onToggleCategory: (category: string) => void;
  onSearch: () => void;
  onCancel: () => void;
}

const MODE_ITEMS: Array<{ value: SearchMode; label: string; sources: string }> = [
  { value: 'ru', label: 'Россия', sources: 'hh.ru, rabota.ru, superjob.ru' },
  { value: 'global', label: 'Мир', sources: 'RemoteOK, We Work Remotely, 4DayWeek, Djinni' },
  { value: 'telegram', label: 'Telegram', sources: 'каналы с вакансиями' },
];

export function SearchForm({
  prompt,
  cityPreset,
  searchMode,
  selectedCategories,
  isLoading,
  canCancel,
  cancelDisabled,
  onPromptChange,
  onCityPresetChange,
  onSearchModeChange,
  onClearCategories,
  onToggleCategory,
  onSearch,
  onCancel,
}: SearchFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isNonRussianMode = searchMode === 'global' || searchMode === 'telegram';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && prompt.trim()) {
      onSearch();
    }
  };

  return (
    <Card className="mb-8">
      <CardContent className="space-y-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="job-query" className="sr-only">
                Опишите подходящую работу
              </label>
              <Input
                id="job-query"
                name="job-query"
                autoComplete="off"
                aria-describedby="job-query-help"
                placeholder="Например, удалённая работа с гибким графиком и минимумом созвонов…"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                disabled={isLoading}
                className="text-base"
              />
              <p id="job-query-help" className="sr-only">
                Укажите роль, формат, график, зарплату или город обычными словами.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="submit" disabled={isLoading || !prompt.trim()} className="min-w-[5.5rem]">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Найти</span>
              </Button>
              {canCancel && (
                <Button type="button" variant="destructive" onClick={onCancel} disabled={cancelDisabled}>
                  Остановить
                </Button>
              )}
            </div>
          </div>

          <fieldset className="min-w-0">
            <legend className="sr-only">Регион поиска</legend>
            <div className="flex flex-wrap gap-2">
              {MODE_ITEMS.map((mode) => {
                const active = searchMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => onSearchModeChange(mode.value)}
                    disabled={isLoading}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm transition-colors disabled:opacity-50 ${
                      active
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-muted'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {MODE_ITEMS.find((m) => m.value === searchMode)?.sources}
            </p>
          </fieldset>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdvancedOpen((prev) => !prev)}
              aria-expanded={advancedOpen}
              aria-controls="advanced-search-filters"
              disabled={isLoading}
              className="h-11 px-2"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Уточнить поиск
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
            <section
              id="advanced-search-filters"
              aria-label="Дополнительные фильтры"
              hidden={!advancedOpen}
              className="mt-3 space-y-4 rounded-lg border border-input/60 bg-muted/40 p-4"
            >
              <div className="space-y-2">
                <label htmlFor="job-city" className="text-sm font-medium">
                  Город
                </label>
                <select
                  id="job-city"
                  name="city"
                  value={cityPreset}
                  onChange={(e) => onCityPresetChange(e.target.value)}
                  disabled={isLoading || isNonRussianMode}
                  className={`h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isNonRussianMode ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {RU_LOCATION_SUGGESTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Категории</span>
                  {selectedCategories.length > 0 && searchMode === 'ru' && (
                    <Button type="button" variant="ghost" size="sm" onClick={onClearCategories}>
                      Сбросить
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {HH_CATEGORIES.map((cat) => {
                    const pressed = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={pressed}
                        disabled={isLoading || isNonRussianMode}
                        onClick={() => onToggleCategory(cat)}
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                          pressed
                            ? 'border-transparent bg-primary text-primary-foreground'
                            : 'border-input bg-background hover:bg-muted'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Город и категории необязательны. Их можно написать прямо в запросе.
              </p>
            </section>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
