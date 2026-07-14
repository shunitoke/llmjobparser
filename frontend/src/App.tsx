import { useCallback, useEffect, useMemo, useState } from 'react';
import { Github, Send, X } from 'lucide-react';
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

const THEME_COLOR_LIGHT = '#fafafa';
const THEME_COLOR_DARK = '#09090b';

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
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) apply(e.matches);
    };
    if (saved) {
      apply(saved === 'dark');
    } else {
      apply(mq?.matches ?? false);
    }
    mq?.addEventListener('change', handler);
    return () => mq?.removeEventListener('change', handler);
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

  const ModalOverlay = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-12 backdrop-blur-sm animate-scale-in"
      role="dialog"
      aria-modal="true"
      onClick={() => setShowKeySettings(false)}
    >
      {children}
    </div>
  );

  if (keyConfigured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-zinc-800 border-t-emerald-500" />
          <div className="text-xl font-semibold tracking-tight text-zinc-100">
            vibe<span className="text-emerald-500">job</span>
          </div>
        </div>
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>

      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowSourceSheet(true)} className="text-muted-foreground">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
              </svg>
              Источники
            </Button>
            {isDesktop() && (
              <Button variant="ghost" size="sm" onClick={() => setShowKeySettings(true)} className="text-muted-foreground">
                Ключ API
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowTelegramSettings(true)} className="text-muted-foreground">
              TG-каналы
            </Button>
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {showKeySettings && (
        <ModalOverlay>
          <Card className="relative w-full max-w-md animate-scale-in shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8"
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
        </ModalOverlay>
      )}

      {showTelegramSettings && (
        <ModalOverlay>
          <Card className="relative w-full max-w-md animate-scale-in shadow-xl" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-8 w-8"
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
        </ModalOverlay>
      )}

      <SourceStatusSheet open={showSourceSheet} onClose={() => setShowSourceSheet(false)} />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      >
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Опишите работу мечты —
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            vibejob найдёт подходящие вакансии по вашим критериям. Пишите по-человечески: роль, график, удалёнка, зарплата, город.
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
          className={`flex justify-center overflow-hidden transition-all duration-150 ease-in motion-reduce:transition-none ${
            !showSourceLogos
              ? 'pointer-events-none mb-0 mt-0 max-h-0 opacity-0'
              : 'mb-10 mt-6 max-h-24 opacity-100'
          }`}
          aria-hidden={!showSourceLogos}
        >
          <SourceLogos />
        </div>

        {error && (
          <Card className="mb-8 border-destructive/50">
            <CardContent className="flex items-center gap-2 pt-6 text-sm text-destructive">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              {error}
            </CardContent>
          </Card>
        )}

        {status && !['completed', 'cancelled', 'failed'].includes(status.status) && <StatusPanel status={status} />}

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

      <footer className="border-t border-border/60 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            vibejob &mdash; поиск работы через нейросеть
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <a href="https://t.me/fastmvpbot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" title="Telegram">
              <Send className="h-3 w-3" />
              @fastmvpbot
            </a>
            <a href="https://github.com/shunitoke/llmjobparser" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" title="GitHub">
              <Github className="h-3 w-3" />
              GitHub
            </a>
            <a href="https://web.tribute.tg/p/A0B" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors" title="Поблагодарить">
              💸 Поблагодарить
            </a>
          </div>
        </div>
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
