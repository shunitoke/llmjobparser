import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, ExternalLink, CheckCircle2, XCircle, Building2, MapPin, Briefcase, ChevronDown } from 'lucide-react';
import { createSearch, getSearchStatus, getSearchSession } from './api';
import { SearchSession, SearchStatus, Job } from './types';

const CITIES = [
  "Любой город",
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Омск",
  "Ростов-на-Дону",
  "Уфа",
  "Красноярск",
  "Воронеж",
  "Пермь",
  "Волгоград",
];

const HH_CATEGORIES = [
  "IT, интернет, телеком",
  "Бухгалтерия, финансы",
  "Маркетинг, реклама, PR",
  "Продажи",
  "Административный персонал",
  "Банки, инвестиции",
  "Безопасность",
  "Высший менеджмент",
  "Госслужба, НКО",
  "Добыча сырья",
  "Домашний персонал",
  "Закупки",
  "Искусство, развлечения",
  "Консультирование",
  "Красота, фитнес, спорт",
  "Логистика, склад",
  "Медицина, фармацевтика",
  "Наука, образование",
  "Недвижимость",
  "Производство",
  "Рабочий персонал",
  "Розничная торговля",
  "Сельское хозяйство",
  "СМИ, издательство",
  "Страхование",
  "Строительство",
  "Транспорт, автобизнес",
  "Туризм, гостиницы, рестораны",
  "Управление персоналом",
  "Юристы",
];

function App() {
  const [prompt, setPrompt] = useState('');
  const [city, setCity] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = useCallback(async (sessionId: number) => {
    try {
      const newStatus = await getSearchStatus(sessionId);
      setStatus(newStatus);

      if (newStatus.status === 'completed') {
        const session = await getSearchSession(sessionId);
        setCurrentSession(session);
        setIsLoading(false);
      } else {
        setTimeout(() => pollStatus(sessionId), 2000);
      }
    } catch (err) {
      setError('Ошибка при получении статуса');
      setIsLoading(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentSession(null);
    setStatus(null);

    try {
      const cityToSend = city === "Любой город" ? "" : city;
      const session = await createSearch(prompt, cityToSend, selectedCategories);
      setCurrentSession(session);
      pollStatus(session.id);
    } catch (err) {
      setError('Ошибка при создании поиска');
      setIsLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Ожидание...',
      generating_queries: 'Генерация поисковых запросов...',
      scraping: 'Сбор вакансий с hh.ru...',
      analyzing: 'Анализ вакансий с помощью AI...',
      completed: 'Завершено',
    };
    return statusMap[status] || status;
  };

  const matchedJobs = currentSession?.jobs.filter(j => j.is_match === true) || [];
  const unmatchedJobs = currentSession?.jobs.filter(j => j.is_match === false) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            LLM Job Parser
          </h1>
          <p className="text-muted-foreground text-lg">
            Опишите желаемую работу, и AI найдёт подходящие вакансии
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Например: ненапряжная работа чтобы заниматься личными делами"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLoading}
                className="text-base"
              />
              <Button onClick={handleSearch} disabled={isLoading || !prompt.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2">Найти</span>
              </Button>
            </div>
            
            <div className="flex gap-3 items-center">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={isLoading}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCategories(!showCategories)}
                className="flex items-center gap-1"
              >
                Категории {selectedCategories.length > 0 && `(${selectedCategories.length})`}
                <ChevronDown className={`h-4 w-4 transition-transform ${showCategories ? 'rotate-180' : ''}`} />
              </Button>
              
              {selectedCategories.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategories([])}>
                  Сбросить
                </Button>
              )}
            </div>
            
            {showCategories && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                {HH_CATEGORIES.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategories.includes(cat) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-8 border-destructive">
            <CardContent className="pt-6 text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {status && status.status !== 'completed' && (
          <Card className="mb-8">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{getStatusText(status.status)}</p>
                  {status.status === 'scraping' && status.current_query && (
                    <p className="text-sm text-muted-foreground">
                      Поиск: «{status.current_query}»
                    </p>
                  )}
                </div>
              </div>
              
              {status.status === 'scraping' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Собрано вакансий</span>
                    <span className="font-medium">{status.scraped_count} / 50</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min((status.scraped_count / 50) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {status.status === 'analyzing' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Анализ вакансий</span>
                    <span className="font-medium">{status.analyzed_jobs} / {status.total_jobs}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${status.total_jobs > 0 ? (status.analyzed_jobs / status.total_jobs) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Подходит: {status.matched_jobs}
                  </p>
                </div>
              )}
              
              {status.generated_queries && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Запросы: </span>
                  {JSON.parse(status.generated_queries).join(', ')}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {status?.status === 'completed' && (
          <div className="mb-6 flex items-center gap-4">
            <Badge variant="success" className="text-sm py-1 px-3">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Подходит: {matchedJobs.length}
            </Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3">
              <XCircle className="h-4 w-4 mr-1" />
              Не подходит: {unmatchedJobs.length}
            </Badge>
          </div>
        )}

        {matchedJobs.length > 0 && (
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold">Подходящие вакансии</h2>
            {matchedJobs.map((job) => (
              <JobCard key={job.id} job={job} isMatch={true} />
            ))}
          </div>
        )}

        {unmatchedJobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">Не подходят</h2>
            {unmatchedJobs.map((job) => (
              <JobCard key={job.id} job={job} isMatch={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, isMatch }: { job: Job; isMatch: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-all ${isMatch ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20' : 'opacity-60'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg leading-tight">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline inline-flex items-center gap-1"
              >
                {job.title}
                <ExternalLink className="h-4 w-4 opacity-50" />
              </a>
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {job.company && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {job.company}
                </span>
              )}
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
              )}
              {job.salary && (
                <span className="font-medium text-foreground">{job.salary}</span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {job.match_reason && (
          <p className={`text-sm mb-3 ${isMatch ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
            {job.match_reason}
          </p>
        )}
        {job.experience && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <Briefcase className="h-3 w-3" />
            {job.experience}
          </div>
        )}
        {job.description && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs px-0 h-auto"
            >
              {expanded ? 'Скрыть описание' : 'Показать описание'}
            </Button>
            {expanded && (
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line max-h-60 overflow-y-auto">
                {job.description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default App;
