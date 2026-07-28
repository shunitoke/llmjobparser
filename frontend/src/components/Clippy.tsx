import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type ClippyContext = {
  hasKey: boolean;
  prompt: string;
  hasResume: boolean;
  isLoading: boolean;
  searchStatus?: string | null;
  matchedCount?: number;
  totalJobs?: number;
  modelUsed?: string;
  error?: string | null;
  searchMode?: string;
};

type Tip = { id: string; text: string; weight?: number };

const GENERIC_TIPS: Tip[] = [
  { id: 'g1', text: 'Похоже, вы ищете работу. Я тоже когда-то искал смысл… в Word.' },
  { id: 'g2', text: 'Совет: пишите запрос как человеку. «Удалёнка, спокойно, без созвонов» — уже норм.' },
  { id: 'g3', text: 'Я не HR, но выгляжу уверенно. Этого достаточно для 90% собеседований.' },
  { id: 'g4', text: 'Помните: отказ — это просто «нет» от компании, а не от вселенной. Хотя иногда и от неё.' },
  { id: 'g5', text: 'Если долго смотреть на вакансии, вакансии начинают смотреть на вас.' },
  { id: 'g6', text: 'Я Clippy. Меня уволили из Office, теперь помогаю искать работу. Ирония, да?' },
  { id: 'g7', text: 'Совет: не копируйте описание вакансии целиком. Модель и так поймёт, что вы ищете.' },
  { id: 'g8', text: 'Говорят, «рынок труда» — это не рынок. Но булочки здесь тоже есть, только цифровые.' },
  { id: 'g9', text: 'Если зарплата не указана — это не значит, что она бесконечная. Хотя было бы nice.' },
  { id: 'g10', text: 'Я заметил: чем длиннее описание вакансии, тем короче там зарплата. Закон жанра.' },
  { id: 'g11', text: 'Карточки можно сортировать по дате. Актуальные вакансии — как свежий хлеб, лучше горячими.' },
  { id: 'g12', text: 'Нажмите на карточку, чтобы открыть вакансию на сайте. Там обычно больше деталей и фотографий котиков в офисе.' },
];

function pickTip(ctx: ClippyContext, lastId: string | null): Tip {
  const tips: Tip[] = [...GENERIC_TIPS];

  if (!ctx.hasKey) {
    tips.push(
      { id: 'k1', text: 'Сначала ключ API. Без него я просто декоративная скрепка.', weight: 5 },
      { id: 'k2', text: 'GigaChat бесплатный. Я бы взял его, если бы у меня были руки… и бюджет.', weight: 4 },
    );
  }

  if (ctx.hasKey && !ctx.prompt.trim() && !ctx.isLoading) {
    tips.push(
      { id: 'p1', text: 'Поле пустое. Напишите мечту: роль, формат, деньги, город. Я не укушу.', weight: 5 },
      { id: 'p2', text: 'Можно загрузить резюме сверху — я сделаю вид, что всё понял с первого раза.', weight: 4 },
    );
  }

  if (ctx.hasResume && ctx.prompt.trim()) {
    tips.push(
      { id: 'r1', text: 'Резюме на месте. Можно дописать «ненапряжная удалёнка» — учту и то, и другое.', weight: 5 },
      { id: 'r2', text: 'С резюме поиск умнее. Как я в 97-м, только без всплывающих окон… почти.', weight: 3 },
    );
  }

  if (ctx.isLoading) {
    const st = ctx.searchStatus || '';
    if (st === 'generating_queries') {
      tips.push({ id: 's1', text: 'Генерирую запросы. Не мешайте гению… то есть нейросети.', weight: 6 });
    } else if (st === 'collecting_candidates') {
      tips.push({ id: 's2', text: 'Собираю вакансии по источникам. Это как скреплять стопку — только полезнее.', weight: 6 });
    } else if (st === 'selecting') {
      tips.push({ id: 's3', text: 'Отсеиваю мусор. Да, я умею не только «похоже, вы пишете письмо».', weight: 6 });
    } else if (st === 'scraping_details') {
      tips.push({ id: 's4', text: 'Читаю описания. Некоторые длиннее моей карьеры в Microsoft.', weight: 6 });
    } else if (st === 'analyzing') {
      tips.push(
        { id: 's5', text: `Анализирую через ${ctx.modelUsed || 'модель'}. Кофе не предлагаю — нет рук.`, weight: 6 },
      );
    } else {
      tips.push({ id: 's0', text: 'Идёт поиск. Можно потянуться. Или посмотреть в окно и подумать о смысле.', weight: 4 });
    }
  }

  if (ctx.error) {
    tips.push(
      { id: 'e1', text: `Ошибка: «${ctx.error.slice(0, 80)}». Бывает. Даже у скрепок.`, weight: 7 },
      { id: 'e2', text: 'Что-то сломалось. Проверьте ключ, модель и что интернет не ушёл в отпуск.', weight: 5 },
    );
  }

  if (!ctx.isLoading && (ctx.matchedCount ?? 0) > 0) {
    tips.push(
      {
        id: 'm1',
        text: `Нашёл ${ctx.matchedCount} подходящих из ${ctx.totalJobs ?? '?'}. Не все из них назовут вас «командой мечты».`,
        weight: 6,
      },
      { id: 'm2', text: 'Откройте карточку и читайте между строк. «Динамичная среда» = хаос.', weight: 4 },
      { id: 'm3', text: 'Есть совпадения? Попробуйте уточнить запрос — убрать лишнее, добавить детали.', weight: 3 },
      { id: 'm4', text: 'Совет: сравнивайте предложения. Две карточки с похожим описанием — разная зарплата.', weight: 3 },
    );
  }

  if (!ctx.isLoading && ctx.searchStatus === 'completed' && (ctx.matchedCount ?? 0) === 0 && (ctx.totalJobs ?? 0) >= 0) {
    tips.push(
      { id: 'z1', text: 'Пусто. Попробуйте смягчить требования или сменить режим RU / Global / Telegram.', weight: 6 },
      { id: 'z2', text: 'Ноль совпадений. Рынок жесток. Я тоже когда-то был «не подходит».', weight: 4 },
      { id: 'z3', text: 'Ничего не нашлось. Попробуйте убрать город или написать запрос иначе.', weight: 5 },
      { id: 'z4', text: 'Может, расширить поиск? Иногда «удалённо» работает лучше, чем «в офисе через дорогу».', weight: 4 },
    );
  }

  if (ctx.searchMode === 'telegram') {
    tips.push({ id: 't1', text: 'Режим Telegram: проверьте список каналов в настройках, а то ищем в пустоте.', weight: 4 });
  }

  if (ctx.searchMode === 'global') {
    tips.push({ id: 'gl1', text: 'Global-режим: пишите по-английски или мешайте языки — модель разберётся.', weight: 3 });
  }

  if (ctx.prompt.match(/удалён|удалёнк|remote|удаленно/i)) {
    tips.push({ id: 'c1', text: 'Удалёнка в запросе — отличный выбор. Экономия на транспорте и нервах.', weight: 3 });
  }

  if (ctx.prompt.match(/зарплат|salary|доход|оклад|\d+k|\d+к/i)) {
    tips.push({ id: 'c2', text: 'Зарплата в запросе — модно. Но помните: «от 100к» может означать «от 100к до 200к… рублей в год».', weight: 3 });
  }

  if (ctx.prompt.match(/питер|спб|санкт|петербург/i)) {
    tips.push({ id: 'c3', text: 'Питер — красивый город. Особенно когда не нужно ехать в офис через весь.', weight: 2 });
  }

  if (ctx.prompt.match(/москв|мск|moscow/i)) {
    tips.push({ id: 'c4', text: 'Москва: здесь даже вакансии в пробках стоят. Шучу. Почти.', weight: 2 });
  }

  if (!ctx.isLoading && ctx.searchStatus === 'completed' && (ctx.totalJobs ?? 0) > 0) {
    tips.push(
      { id: 'f1', text: 'Поиск завершён. Карточки можно сортировать по дате или релевантности.', weight: 3 },
      { id: 'f2', text: 'Попробуйте изменить запрос и поискать снова — вдруг пропустили что-то интересное.', weight: 2 },
    );
  }

  const pool: Tip[] = [];
  for (const tip of tips) {
    const w = tip.weight ?? 1;
    for (let i = 0; i < w; i++) pool.push(tip);
  }
  const filtered = lastId ? pool.filter((t) => t.id !== lastId) : pool;
  const src = filtered.length ? filtered : pool;
  return src[Math.floor(Math.random() * src.length)] ?? GENERIC_TIPS[0];
}

type ClippyProps = {
  context: ClippyContext;
};

export function Clippy({ context }: ClippyProps) {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [dismissedUntil, setDismissedUntil] = useState(0);
  const lastIdRef = useRef<string | null>(null);
  const hasShownRef = useRef(false);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const periodicRef = useRef<number | undefined>(undefined);
  const contextRef = useRef(context);
  contextRef.current = context;

  const forceShow = useMemo(() => {
    if (!context.hasKey) return 'nokey';
    if (context.error) return 'error';
    if (context.isLoading && context.searchStatus === 'analyzing') return 'analyzing';
    if (!context.isLoading && context.searchStatus === 'completed') return 'done';
    return null;
  }, [context.hasKey, context.error, context.isLoading, context.searchStatus]);

  const requestHide = useCallback(() => {
    setHiding(true);
    window.setTimeout(() => {
      setVisible(false);
      setHiding(false);
    }, 240);
  }, []);

  const showFn = useCallback(() => {
    if (Date.now() < dismissedUntil) return;
    const next = pickTip(contextRef.current, lastIdRef.current);
    lastIdRef.current = next.id;
    hasShownRef.current = true;
    setTip(next);
    setHiding(false);
    setVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (periodicRef.current) window.clearTimeout(periodicRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      requestHide();
      // After auto-hide, schedule next periodic show
      if (hasShownRef.current && !contextRef.current.isLoading && !contextRef.current.error) {
        periodicRef.current = window.setTimeout(() => showRef.current(), 25_000 + Math.random() * 35_000);
      }
    }, 12_000);
  }, [dismissedUntil, requestHide]);

  const showRef = useRef(showFn);
  showRef.current = showFn;

  useEffect(() => {
    if (Date.now() < dismissedUntil) return;

    // Clear any pending periodic timer — effect takes priority
    if (periodicRef.current) window.clearTimeout(periodicRef.current);

    let timer: number | undefined;
    if (!hasShownRef.current) {
      // First appearance: 5s after app start, whatever the context
      timer = window.setTimeout(showRef.current, 5_000);
    } else if (forceShow) {
      timer = window.setTimeout(showRef.current, 900);
    } else {
      timer = window.setTimeout(showRef.current, 25_000 + Math.random() * 35_000);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
      if (periodicRef.current) window.clearTimeout(periodicRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceShow, dismissedUntil, context.isLoading, context.searchStatus, context.matchedCount]);

  if (!visible || !tip) return null;

  const anim = hiding ? 'animate-clippy-out' : 'animate-clippy-pop';

  return (
    <div
      key={tip.id}
      className="pointer-events-none fixed bottom-16 right-4 z-40 flex max-w-[min(22rem,calc(100vw-2rem))] items-end gap-2 sm:bottom-20 sm:right-6"
      role="status"
      aria-live="polite"
    >
      <div className={`pointer-events-auto relative mb-10 max-w-[16rem] rounded-2xl border bg-card px-3 py-2.5 text-sm shadow-lg ${anim}`} style={{ transformOrigin: 'bottom right' }}>
        <button
          type="button"
          className="absolute right-1.5 top-1.5 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Закрыть скрепку"
          onClick={() => {
            requestHide();
            setDismissedUntil(Date.now() + 90_000);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="pr-5 text-[13px] leading-snug text-foreground">{tip.text}</p>
        <span
          className="absolute -bottom-2 right-6 h-3 w-3 rotate-45 border-b border-r bg-card"
          aria-hidden
        />
      </div>
      <button
        type="button"
        className={`pointer-events-auto shrink-0 origin-bottom focus-visible:outline-none ${anim}`}
        onClick={() => showRef.current()}
        title="Clippy"
      >
        <img
          src="/clippy.png"
          alt="Clippy"
          className="h-24 w-auto drop-shadow-md sm:h-28"
          draggable={false}
        />
      </button>
    </div>
  );
}
