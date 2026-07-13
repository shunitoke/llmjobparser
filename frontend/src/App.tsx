import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { CandidateList } from '@/components/CandidateList';
import { FirstRunKeyPrompt } from '@/components/FirstRunKeyPrompt';
import { Logo } from '@/components/Logo';
import { ResultsList } from '@/components/ResultsList';
import { SearchForm } from '@/components/SearchForm';
import { SourceLogos } from '@/components/SourceLogos';
import { StatusPanel } from '@/components/StatusPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getDesktopApi, isDesktop } from '@/lib/desktop';
import { cancelSearch, createSearch, getCandidates, getSearchSession, getSearchStatus } from './api';
import { CandidateJob, Job, SearchSession, SearchStatus } from './types';

type SearchMode = 'ru' | 'global' | 'telegram';
type MatchedSort = 'date' | 'source' | 'location';

const THEME_COLOR_LIGHT = '#f4f6f5';
const THEME_COLOR_DARK = '#0f172a';

function App() {
  const [prompt, setPrompt] = useState('');
  const [cityPreset, setCityPreset] = useState('Любой город');
  const [searchMode, setSearchMode] = useState<SearchMode>('ru');
  const [matchedSort, setMatchedSort] = useState<MatchedSort>('date');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [showSourceLogos, setShowSourceLogos] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidateItems, setCandidateItems] = useState<CandidateJob[]>([]);
  const [candidateTotal, setCandidateTotal] = useState(0);
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [candidateLimit] = useState(50);
  const [candidateReadyOnly, setCandidateReadyOnly] = useState<boolean | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [showCandidatesPanel, setShowCandidatesPanel] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [showKeySettings, setShowKeySettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', shouldBeDark);
    setIsDark(shouldBeDark);
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
    }
  }, [isDark]);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  useEffect(() => {
    if (!isDesktop()) {
      setKeyConfigured(true);
      return;
    }
    getDesktopApi()?.getKeyStatus().then((status) => {
      setKeyConfigured(status.configured);
    });
  }, []);

  const loadCandidates = useCallback(
    async (sessionId: number, offset: number, readyOnly: boolean | null) => {
      setCandidateLoading(true);
      try {
        const res = await getCandidates(sessionId, offset, candidateLimit, null, readyOnly, 'date');
        setCandidateItems(res.items);
        setCandidateTotal(res.total);
        setCandidateOffset(res.offset);
      } catch (e) {
        setCandidateItems([]);
        setCandidateTotal(0);
      } finally {
        setCandidateLoading(false);
      }
    },
    [candidateLimit]
  );

  const pollStatus = useCallback(
    async (sessionId: number) => {
      try {
        const newStatus = await getSearchStatus(sessionId);
        setStatus(newStatus);
        if (newStatus.status === 'collecting_candidates' || newStatus.status === 'selecting') {
          if (candidateOffset === 0) loadCandidates(sessionId, candidateOffset, candidateReadyOnly);
        }
        if (newStatus.status === 'completed') {
          const session = await getSearchSession(sessionId);
          setCurrentSession(session);
          setIsLoading(false);
        } else if (newStatus.status === 'cancelled' || newStatus.status === 'failed') {
          setIsLoading(false);
        } else {
          setTimeout(() => pollStatus(sessionId), 2000);
        }
      } catch (err) {
        setError('Ошибка при получении статуса');
        setIsLoading(false);
      }
    },
    [candidateOffset, candidateReadyOnly, loadCandidates]
  );

  const handleSearch = async () => {
    if (!prompt.trim()) return;
    setShowSourceLogos(false);
    setIsLoading(true);
    setError(null);
    setCurrentSession(null);
    setStatus(null);
    setCandidateItems([]);
    setCandidateTotal(0);
    setCandidateOffset(0);
    setCandidateReadyOnly(null);
    setSelectedLocation(null);
    try {
      const cityToSend = cityPreset === 'Любой город' ? '' : cityPreset;
      const session = await createSearch(prompt, cityToSend, selectedCategories, searchMode);
      setCurrentSession(session);
      loadCandidates(session.id, 0, null);
      pollStatus(session.id);
    } catch (err) {
      setError('Ошибка при создании поиска');
      setIsLoading(false);
    }
  };

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const handleCancel = async () => {
    const sid = activeSessionId;
    if (!sid) return;
    try {
      await cancelSearch(sid);
      setShowSourceLogos(true);
      setIsLoading(false);
      setStatus((prev) => (prev ? { ...prev, status: 'cancelled', current_source: '' } : prev));
    } catch (e) {
      // ignore
    }
  };

  const matchedJobs = currentSession?.jobs.filter((j) => j.is_match === true) || [];
  const unmatchedJobs = currentSession?.jobs.filter((j) => j.is_match === false) || [];
  const filteredMatchedJobs = selectedLocation
    ? matchedJobs.filter((job) => normalizeLocation(job.location) === selectedLocation)
    : matchedJobs;
  const sortedMatchedJobs = sortJobs(filteredMatchedJobs, matchedSort);
  const sortedUnmatchedJobs = sortJobs(unmatchedJobs, matchedSort);
  const canShowCityMap =
    searchMode === 'ru' &&
    cityPreset !== 'Любой город' &&
    cityPreset !== 'Удаленно' &&
    !cityPreset.startsWith('---');
  const cityMapUrl = canShowCityMap
    ? `https://yandex.ru/map-widget/v1/?text=${encodeURIComponent(cityPreset)}&z=11&l=map`
    : '';
  const locationPins = buildLocationPins(matchedJobs).slice(0, 12);
  const activeSessionId = status?.id ?? currentSession?.id;
  const canCancel = Boolean(
    status && status.status !== 'completed' && status.status !== 'cancelled' && status.status !== 'failed'
  );
  const hasSecondaryContent = Boolean(activeSessionId);

  if (keyConfigured === null) {
    return null;
  }

  if (keyConfigured === false) {
    return <FirstRunKeyPrompt onSaved={() => setKeyConfigured(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>

      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            {isDesktop() && (
              <Button variant="outline" size="sm" onClick={() => setShowKeySettings(true)}>
                Ключ API
              </Button>
            )}
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {showKeySettings && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-12 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="key-settings-title"
          onClick={() => setShowKeySettings(false)}
        >
          <Card
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => setShowKeySettings(false)}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle id="key-settings-title">Ключ API GigaChat</CardTitle>
              <CardDescription>
                Ключ используется для анализа вакансий в десктопном приложении.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeySettings onSaved={() => setShowKeySettings(false)} />
            </CardContent>
          </Card>
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      >
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Опишите работу мечты —{' '}
            <span className="text-primary">мы найдём вакансии</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Пишите по-человечески: роль, график, удалёнка, зарплата, город или пожелания.
          </p>
        </div>

        <SearchForm
          prompt={prompt}
          cityPreset={cityPreset}
          searchMode={searchMode}
          selectedCategories={selectedCategories}
          isLoading={isLoading}
          canCancel={canCancel}
          cancelDisabled={!activeSessionId}
          onPromptChange={setPrompt}
          onCityPresetChange={setCityPreset}
          onSearchModeChange={setSearchMode}
          onClearCategories={() => setSelectedCategories([])}
          onToggleCategory={toggleCategory}
          onSearch={handleSearch}
          onCancel={handleCancel}
        />

        <div
          className={`flex justify-center overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-in-out motion-reduce:transition-none ${
            !showSourceLogos
              ? 'mb-0 mt-0 max-h-0 opacity-0 -translate-y-2 pointer-events-none'
              : 'mb-10 mt-4 max-h-40 opacity-100 translate-y-0'
          }`}
          aria-hidden={!showSourceLogos}
        >
          <SourceLogos />
        </div>

        <div
          className={`${
            hasSecondaryContent ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]' : ''
          }`}
        >
          <div className="min-w-0">
            {error && (
              <Card className="mb-8 border-destructive">
                <CardContent className="pt-6 text-destructive">{error}</CardContent>
              </Card>
            )}
            {status && status.status !== 'completed' && <StatusPanel status={status} />}
            <ResultsList
              isCompleted={status?.status === 'completed'}
              matchedJobs={matchedJobs}
              unmatchedJobs={unmatchedJobs}
              sortedMatchedJobs={sortedMatchedJobs}
              sortedUnmatchedJobs={sortedUnmatchedJobs}
              matchedSort={matchedSort}
              onMatchedSortChange={setMatchedSort}
            />
          </div>

          {activeSessionId && (
            <aside className="min-w-0">
              <div className="lg:sticky lg:top-6">
                {canShowCityMap && (
                  <Card className="mb-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Карта города</CardTitle>
                      <CardDescription>Город из текущего запроса</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-hidden rounded-lg border border-input">
                        <iframe
                          title={`Карта ${cityPreset}`}
                          src={cityMapUrl}
                          className="h-56 w-full lg:h-72"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                      {locationPins.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                            <span>Пины по адресам</span>
                            {selectedLocation && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedLocation(null)}
                              >
                                Сбросить фильтр
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 space-y-2">
                            {locationPins.map((pin) => (
                              <button
                                type="button"
                                key={pin.label}
                                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                                  selectedLocation === normalizeLocation(pin.label)
                                    ? 'border-primary/60 bg-primary/10 text-primary'
                                    : 'border-input/60 bg-muted/40 hover:border-primary/40'
                                }`}
                                onClick={() => setSelectedLocation(normalizeLocation(pin.label))}
                              >
                                <span className="truncate">{pin.label}</span>
                                <span className="ml-3 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                  {pin.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                <CandidateList
                  items={candidateItems}
                  total={candidateTotal}
                  offset={candidateOffset}
                  limit={candidateLimit}
                  readyOnly={candidateReadyOnly}
                  loading={candidateLoading}
                  isVisible={showCandidatesPanel}
                  onVisibilityChange={() => setShowCandidatesPanel((prev) => !prev)}
                  onReadyOnlyChange={setCandidateReadyOnly}
                  onLoad={(offset, readyOnly) => loadCandidates(activeSessionId, offset, readyOnly)}
                />
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function getJobSource(job: Job) {
  const id = (job.hh_id || '').toLowerCase();
  if (id.startsWith('hh:')) return 'HH.ru';
  if (id.startsWith('rabota:')) return 'Rabota.ru';
  if (id.startsWith('sj:')) return 'SuperJob';
  if (id.startsWith('tg:')) return 'Telegram';
  if (id.startsWith('remoteok:')) return 'RemoteOK';
  if (id.startsWith('wwr:')) return 'We Work Remotely';
  if (id.startsWith('4dw:')) return '4DayWeek';
  if (id.startsWith('djinni:')) return 'Djinni';
  const url = (job.url || '').toLowerCase();
  if (url.includes('rabota.ru')) return 'Rabota.ru';
  if (url.includes('hh.ru')) return 'HH.ru';
  if (url.includes('superjob.ru')) return 'SuperJob';
  if (url.includes('t.me/')) return 'Telegram';
  if (url.includes('remoteok.com')) return 'RemoteOK';
  if (url.includes('weworkremotely.com')) return 'We Work Remotely';
  if (url.includes('4dayweek.io')) return '4DayWeek';
  if (url.includes('djinni.co')) return 'Djinni';
  return 'Источник';
}

function normalizeLocation(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
}
function toDateMs(value?: string | null) {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : 0;
}
function sortJobs(jobs: Job[], matchedSort: MatchedSort) {
  return [...jobs].sort((a, b) => {
    if (matchedSort === 'source') {
      const c = getJobSource(a).localeCompare(getJobSource(b), 'ru');
      if (c !== 0) return c;
    }
    if (matchedSort === 'location') {
      const c = normalizeLocation(a.location).localeCompare(normalizeLocation(b.location), 'ru');
      if (c !== 0) return c;
    }
    const dateDifference = toDateMs(b.published_at) - toDateMs(a.published_at);
    return dateDifference || b.id - a.id;
  });
}
function buildLocationPins(jobs: Job[]) {
  const map = new Map<string, { label: string; count: number }>();
  for (const job of jobs) {
    const raw = job.location ?? '';
    const key = normalizeLocation(raw);
    if (!key) continue;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { label: raw.trim(), count: 1 });
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru')
  );
}

export default App;
