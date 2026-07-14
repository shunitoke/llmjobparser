const MS_PER_DAY = 86_400_000;

function parseMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function formatDateRu(ms: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatRelativeDate(iso?: string | null): string {
  const ms = parseMs(iso);
  if (ms === null) return '';

  const date = new Date(ms);
  const now = new Date();

  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((nowStart - dateStart) / MS_PER_DAY);

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'вчера';
  if (diffDays >= 2 && diffDays < 5) return `${diffDays} дня назад`;
  if (diffDays >= 5 && diffDays <= 21) return `${diffDays} дней назад`;
  if (diffDays > 21) {
    const rem = diffDays % 10;
    if (rem === 1 && diffDays % 100 !== 11) return `${diffDays} день назад`;
    if (rem >= 2 && rem <= 4 && (diffDays % 100 < 10 || diffDays % 100 >= 20)) {
      return `${diffDays} дня назад`;
    }
    return `${diffDays} дней назад`;
  }

  return formatDateRu(ms);
}
