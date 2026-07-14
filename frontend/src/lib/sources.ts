import { CandidateJob, Job } from '../types';

export interface SourceInfo {
  name: string;
  badgeClass: string;
}

const SOURCE_BY_ID: Record<string, SourceInfo> = {
  'hh:': { name: 'HH.ru', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  'rabota:': { name: 'Rabota.ru', badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400' },
  'sj:': { name: 'SuperJob', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  'tg:': { name: 'Telegram', badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
  'telegram:': { name: 'Telegram', badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
  'remoteok:': { name: 'RemoteOK', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  'wwr:': { name: 'We Work Remotely', badgeClass: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' },
  '4dw:': { name: '4DayWeek', badgeClass: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400' },
  'djinni:': { name: 'Djinni', badgeClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400' },
};

const SOURCE_BY_HOST: Record<string, SourceInfo> = {
  'hh.ru': { name: 'HH.ru', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  'rabota.ru': { name: 'Rabota.ru', badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400' },
  'superjob.ru': { name: 'SuperJob', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  't.me': { name: 'Telegram', badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
  'remoteok.com': { name: 'RemoteOK', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  'weworkremotely.com': { name: 'We Work Remotely', badgeClass: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' },
  '4dayweek.io': { name: '4DayWeek', badgeClass: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400' },
  'djinni.co': { name: 'Djinni', badgeClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400' },
};

const SOURCE_BY_NAME: Record<string, SourceInfo> = {
  hh: { name: 'HH.ru', badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  rabota: { name: 'Rabota.ru', badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400' },
  superjob: { name: 'SuperJob', badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' },
  telegram: { name: 'Telegram', badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
  remoteok: { name: 'RemoteOK', badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  wwr: { name: 'We Work Remotely', badgeClass: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' },
  '4dayweek': { name: '4DayWeek', badgeClass: 'bg-pink-500/10 text-pink-600 border-pink-500/20 dark:text-pink-400' },
  djinni: { name: 'Djinni', badgeClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400' },
};

const FALLBACK: SourceInfo = { name: 'Источник', badgeClass: 'bg-muted text-muted-foreground border-input' };

function getSourceInfo(item: Job | CandidateJob): SourceInfo {
  const hhId = (item.hh_id || '').toLowerCase();
  for (const prefix of Object.keys(SOURCE_BY_ID)) {
    if (hhId.startsWith(prefix)) return SOURCE_BY_ID[prefix];
  }

  const sourceName = ('source' in item ? item.source : null) || null;
  if (sourceName) {
    const normalized = sourceName.toLowerCase().trim();
    if (SOURCE_BY_NAME[normalized]) return SOURCE_BY_NAME[normalized];
  }

  const url = (item.url || '').toLowerCase();
  for (const host of Object.keys(SOURCE_BY_HOST)) {
    if (url.includes(host)) return SOURCE_BY_HOST[host];
  }

  return FALLBACK;
}

export function getJobSource(item: Job | CandidateJob): string {
  return getSourceInfo(item).name;
}

function getTelegramChannelName(item: Job | CandidateJob): string | null {
  const hhId = (item.hh_id || '').toLowerCase();
  // format: "telegram:<channel>:<id>"
  const m = hhId.match(/^telegram:([^:]+):/);
  return m ? m[1] : null;
}

export function getJobSourceLabel(item: Job | CandidateJob): string {
  const info = getSourceInfo(item);
  if (info.name === 'Telegram') {
    const channel = getTelegramChannelName(item);
    if (channel) return channel;
  }
  return info.name;
}

export function getJobSourceBadgeClass(item: Job | CandidateJob): string {
  return getSourceInfo(item).badgeClass;
}

export const SOURCE_ORDER = [
  'hh',
  'rabota',
  'superjob',
  'telegram',
  'remoteok',
  'wwr',
  '4dayweek',
  'djinni',
];

export const SOURCE_KEY_LABELS: Record<string, string> = {
  hh: 'HH.ru',
  rabota: 'Rabota.ru',
  superjob: 'SuperJob',
  telegram: 'Telegram',
  remoteok: 'RemoteOK',
  wwr: 'We Work Remotely',
  '4dayweek': '4DayWeek',
  djinni: 'Djinni',
};
