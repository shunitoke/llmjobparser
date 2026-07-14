import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HH_CATEGORIES, RU_LOCATION_SUGGESTIONS } from '@/lib/locationSuggestions';

const HINTS = [
  'Удалёнка на React от 200к',
  'Дизайнер без созвонов и дедлайнов',
  'Уборщица на полдня в Москве',
  'Python без опыта, стажировка',
  'Копирайтер, только короткие тексты',
  'DevOps в тихую компанию',
  'Курьер с гибким графиком',
  'Аналитик данных, удалённо',
  'Frontend, минимум митингов',
  'Бухгалтер на полставки из дома',
  'Тестировщик мобильных приложений',
  'Маркетолог в стартап без совещаний',
  'Фриланс UX без бюджетных клиентов',
  'Модератор Telegram-каналов',
  'Няня с опытом, дневная смена',
  'Продавец в интернет-магазин',
  'HR без найма, только подбор',
  'Репетитор математики онлайн',
  'Продюсер подкастов',
  'Инженер техподдержки, ночная смена',
  'Кто-нибудь, наймите меня уже',
  'Работа, где можно спать до полудня',
  'Удалёнка на диване в пижаме',
  'CEO стартапа из гаража',
  'Нейросети вместо коллег',
  'Директор по прокрастинации',
  'Верстальщик макетов из Figma',
  'Системный администратор кошачьих сетей',
  'Тимлид без наставничества',
  'ИИ-шник, который боится ИИ',
  'Дизайнер интерфейсов для инопланетян',
  'Fullstack на велосипеде',
  'QA, который ломает всё подряд',
  'DevOps в йога-студии',
  'Продажник без холодных звонков',
  'Контент-мейкер для муравьёв',
  'Скрам-мастер без спринтов',
  'Техподдержка для призраков',
];

const TYPING_SPEED = 35;
const ERASING_SPEED = 18;
const PAUSE_AFTER_TYPING = 1500;

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
  const [focused, setFocused] = useState(false);
  const isNonRussianMode = searchMode === 'global' || searchMode === 'telegram';

  const [hintIdx, setHintIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (focused || prompt) return;

    const target = HINTS[hintIdx];

    if (isTyping) {
      if (typed.length < target.length) {
        timerRef.current = setTimeout(() => {
          setTyped(target.slice(0, typed.length + 1));
        }, TYPING_SPEED);
      } else {
        timerRef.current = setTimeout(() => {
          setIsTyping(false);
        }, PAUSE_AFTER_TYPING);
      }
    } else {
      if (typed.length > 0) {
        timerRef.current = setTimeout(() => {
          setTyped(typed.slice(0, -1));
        }, ERASING_SPEED);
      } else {
        setHintIdx((i) => (i + 1) % HINTS.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timerRef.current);
  }, [typed, isTyping, hintIdx, focused, prompt]);

  useEffect(() => {
    if (focused || prompt) {
      clearTimeout(timerRef.current);
    }
  }, [focused, prompt]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isLoading && prompt.trim()) {
      onSearch();
    }
  };

  const showTyping = !prompt && !focused;

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex flex-col gap-3 rounded-xl border bg-card p-1.5 transition-all sm:flex-row sm:items-center ${
            focused ? 'ring-2 ring-ring/40' : ''
          }`}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="job-query" className="sr-only">
              Опишите подходящую работу
            </label>
            <div className="relative">
              <Input
                id="job-query"
                name="job-query"
                autoComplete="off"
                aria-describedby="job-query-help"
                placeholder=""
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={isLoading}
                className="border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {showTyping && (
                <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-base text-muted-foreground select-none">
                  {typed}
                  <span className="ml-px inline-block h-[1.1em] w-px animate-[blink_1s_step-end_infinite] bg-muted-foreground align-text-bottom" />
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 px-1 pb-1 sm:pb-0 sm:pl-0">
            {canCancel && (
              <Button type="button" variant="destructive" onClick={onCancel} disabled={cancelDisabled} size="sm">
                Остановить
              </Button>
            )}
            <Button type="submit" disabled={isLoading || !prompt.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Найти</span>
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border bg-card p-0.5" role="radiogroup" aria-label="Регион поиска">
          {MODE_ITEMS.map((mode) => {
            const active = searchMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSearchModeChange(mode.value)}
                disabled={isLoading}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-50 ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          aria-expanded={advancedOpen}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Фильтры
          <ChevronDown className={`h-3 w-3 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        <span className="text-xs text-muted-foreground">
          {MODE_ITEMS.find((m) => m.value === searchMode)?.sources}
        </span>
      </div>

      {advancedOpen && (
        <div
          id="advanced-search-filters"
          aria-label="Дополнительные фильтры"
          className="mt-3 space-y-4 rounded-xl border bg-card p-4"
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
              className={`h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
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
                <button type="button" onClick={onClearCategories} className="text-xs text-muted-foreground hover:text-foreground">
                  Сбросить
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {HH_CATEGORIES.map((cat) => {
                const pressed = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={pressed}
                    disabled={isLoading || isNonRussianMode}
                    onClick={() => onToggleCategory(cat)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50 ${
                      pressed
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-input bg-background text-muted-foreground hover:border-muted-foreground hover:text-foreground'
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
        </div>
      )}
    </div>
  );
}
