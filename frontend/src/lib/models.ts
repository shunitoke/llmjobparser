const MODEL_LABELS: Record<string, string> = {
  'GigaChat-2': 'GigaChat 2 Lite',
  'GigaChat-2-Pro': 'GigaChat 2 Pro',
  'GigaChat-2-Max': 'GigaChat 2 Max',
  'GigaChat-3-Ultra': 'GigaChat 3 Ultra',
  GigaChat: 'GigaChat 2 Lite',
  'GigaChat-Lite': 'GigaChat 2 Lite',
  'GigaChat-Pro': 'GigaChat 2 Pro',
  'GigaChat-Max': 'GigaChat 2 Max',
  'GigaChat-Ultra': 'GigaChat 3 Ultra',
};

/** Human-readable model name for UI (API ids stay unchanged). */
export function formatModelLabel(model?: string | null): string {
  if (!model) return '';
  return MODEL_LABELS[model] ?? model;
}
