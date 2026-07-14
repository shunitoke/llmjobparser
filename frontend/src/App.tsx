import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { CandidateList } from '@/components/CandidateList';
import { FirstRunKeyPrompt } from '@/components/FirstRunKeyPrompt';
import { Logo } from '@/components/Logo';
import { ResumeUpload } from '@/components/ResumeUpload';
import { TelegramChannelsSettings } from '@/components/TelegramChannelsSettings';
import { ResultsList, ResultsSort, ResultsTab } from '@/components/ResultsList';
import { SearchForm } from '@/components/SearchForm';
import { SourceLogos } from '@/components/SourceLogos';
import { SourceStatusSheet } from '@/components/SourceStatusSheet';
import { StatusPanel } from '@/components/StatusPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isDesktop, waitForDesktopApi } from '@/lib/desktop';
import { getJobSource } from '@/lib/sources';
import { cancelSearch, createSearch, getCandidates, getSearchSession, getSearchStatus } from './api';
import { CandidateJob, Job, SearchSession, SearchStatus } from './types';

type SearchMode = 'ru' | 'global' | 'telegram';

const THEME_COLOR_LIGHT = '#f4f6f5';
const THEME_COLOR_DARK = '#0f172a';

function App() {
  const [prompt, setPrompt] = useState('');
  const [cityPreset, setCityPreset] = useState('Любой город');
  const [searchMode, setSearchMode] = useState<SearchMode>('ru');
  const [sort, setSort] = useState<ResultsSort>('relevance');
  const [selectedTab, setSelectedTab] = useState<ResultsTab>('matched');
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
  const [candidateSelectedOnly, setCandidateSelectedOnly] = useState<boolean | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [showCandidatesPanel, setShowCandidatesPanel] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null);
  const [showKeySettings, setShowKeySettings] = useState(false);
  const [showTelegramSettings, setShowTelegramSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    if (saved) {
      apply(saved === 'dark');
    } else {
      apply(mq?.matches ?? false);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq?.addEventListener('change', handler);
      return () => mq?.removeEventListener('change', handler);
    }
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
    waitForDesktopApi().then((api) => {
      if (!api) {
        setKeyConfigured(false);
        return;
      }
      api.getKeyStatus().then((s) => {
        setKeyConfigured(s.configured);
      });
    });
  }, []);

  const loadCandidates = useCallback(
    async (sessionId: number, offset: number, selectedOnly: boolean | null) => {
      setCandidateLoading(true);
      try {
        const res = await getCandidates(sessionId, offset, candidateLimit, selectedOnly, null, 'created_at');
        setCandidateItems(res.items);
        setCandidateTotal(res.total);
        setCandidateOffset(res.offset);
      } catch (e) {
        setCandidateItems([]);
        setCandidateTotal(0);
        setCandidateOffset(0);
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
          if (candidateOffset === 0) loadCandidates(sessionId, candidateOffset, candidateSelectedOnly);
        }
        if (newStatus.status === 'completed') {
          const session = await getSearchSession(sessionId);
          setCurrentSession(session);
          setIsLoading(false);
          setSelectedTab('matched');
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
    [candidateOffset, candidateSelectedOnly, loadCandidates]
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
    setCandidateSelectedOnly(null);
    setSort('relevance');
    setSelectedTab('matched');
    try {
      const cityToSend = cityPreset === 'Любой город' ? '' : cityPreset;
      const session = await createSearch(prompt, cityToSend, selectedCategories, searchMode);
      setCurrentSession(session);
      setShowCandidatesPanel(true);
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

  const sortedJobs = useMemo(() => {
    const jobs = currentSession?.jobs ?? [];
    return sortJobs(jobs, sort);
  }, [currentSession?.jobs, sort]);

  const matchedJobs = useMemo(() => sortedJobs.filter((j) => j.is_match === true), [sortedJobs]);
  const unmatchedJobs = useMemo(() => sortedJobs.filter((j) => j.is_match === false), [sortedJobs]);
  const allJobs = sortedJobs;

  const activeSessionId = status?.id ?? currentSession?.id;
  const canCancel = Boolean(
    status && status.status !== 'completed' && status.status !== 'cancelled' && status.status !== 'failed'
  );

  if (keyConfigured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (keyConfigured === false) {
    return (
      <FirstRunKeyPrompt
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSaved={(resumePrompt) => {
          setKeyConfigured(true);
          if (resumePrompt) setPrompt(resumePrompt);
        }}
      />
    );
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
            <Button variant="outline" size="sm" onClick={() => setShowSourceSheet(true)}>
              Источники
            </Button>
            {isDesktop() && (
              <Button variant="outline" size="sm" onClick={() => setShowKeySettings(true)}>
                Ключ API
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowTelegramSettings(true)}>
              TG-каналы
            </Button>
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
          <Card className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
              <CardTitle id="key-settings-title">Настройки API</CardTitle>
              <CardDescription>Ключ используется для анализа вакансий. Хранится только на этом компьютере.</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeySettings
                onSaved={() => setShowKeySettings(false)}
                onDeleted={() => {
                  setShowKeySettings(false);
                  setKeyConfigured(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {showTelegramSettings && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 px-4 py-12 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="telegram-settings-title"
          onClick={() => setShowTelegramSettings(false)}
        >
          <Card className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => setShowTelegramSettings(false)}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </Button>
            <CardHeader>
              <CardTitle id="telegram-settings-title">Telegram-каналы</CardTitle>
              <CardDescription>Настройте каналы, из которых vibejob собирает вакансии.</CardDescription>
            </CardHeader>
            <CardContent>
              <TelegramChannelsSettings />
            </CardContent>
          </Card>
        </div>
      )}

      <SourceStatusSheet open={showSourceSheet} onClose={() => setShowSourceSheet(false)} />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      >
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Опишите работу мечты —{' '}
            <span className="text-primary">vibejob найдёт вакансии</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Пишите по-человечески: роль, график, удалёнка, зарплата, город или пожелания.
          </p>
        </div>

        <div className="mb-6">
          <ResumeUpload onParsed={(p) => setPrompt(p)} />
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
              ? 'pointer-events-none mb-0 mt-0 max-h-0 opacity-0 -translate-y-2'
              : 'mb-10 mt-4 max-h-40 opacity-100 translate-y-0'
          }`}
          aria-hidden={!showSourceLogos}
        >
          <SourceLogos />
        </div>

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
          allJobs={allJobs}
          sort={sort}
          selectedTab={selectedTab}
          onSortChange={setSort}
          onTabChange={setSelectedTab}
        />

        {activeSessionId && (
          <div className="mt-10">
            <CandidateList
              items={candidateItems}
              total={candidateTotal}
              offset={candidateOffset}
              limit={candidateLimit}
              selectedOnly={candidateSelectedOnly}
              loading={candidateLoading}
              isVisible={showCandidatesPanel}
              onVisibilityChange={() => setShowCandidatesPanel((prev) => !prev)}
              onSelectedOnlyChange={setCandidateSelectedOnly}
              onLoad={(offset, selectedOnly) => loadCandidates(activeSessionId, offset, selectedOnly)}
            />
          </div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        <a href="https://t.me/fastmvpbot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline" title="Telegram">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.127.037.358.029.536-.076 3.834-.405 8.097-.572 9.653-.072.662-.213.884-.35 1.042-.296.34-.624.358-1.04.222-.64-.214-3.443-2.21-4.724-3.162h-.001l-.687-.54c-.424-.34-.148-1.03.186-1.317l.018-.014 3.086-2.979c.38-.374.076-.566-.15-.446l-3.947 2.524c-.058.036-.17.093-.298.096a.56.56 0 0 1-.316-.106c-.425-.317-1.222-.795-1.628-1.043-.143-.087-.377-.293-.13-.578.1-.114.275-.232.472-.353l7.396-4.683c.079-.044.337-.139.538-.148z"/></svg>
          @fastmvpbot
        </a>
        <span className="mx-2">·</span>
        <a href="https://github.com/shunitoke/llmjobparser" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline" title="GitHub">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
          GitHub
        </a>
      </footer>
    </div>
  );
}

function normalizeLocation(value?: string | null) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function toDateMs(value?: string | null) {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : 0;
}

function sortJobs(jobs: Job[], sort: ResultsSort) {
  return [...jobs].sort((a, b) => {
    if (sort === 'relevance') {
      const ma = a.is_match === true ? 1 : a.is_match === false ? -1 : 0;
      const mb = b.is_match === true ? 1 : b.is_match === false ? -1 : 0;
      if (ma !== mb) return mb - ma;
    }
    if (sort === 'source') {
      const c = getJobSource(a).localeCompare(getJobSource(b), 'ru');
      if (c !== 0) return c;
    }
    if (sort === 'location') {
      const c = normalizeLocation(a.location).localeCompare(normalizeLocation(b.location), 'ru');
      if (c !== 0) return c;
    }
    const dateDifference = toDateMs(b.published_at) - toDateMs(a.published_at);
    return dateDifference || b.id - a.id;
  });
}

export default App;
