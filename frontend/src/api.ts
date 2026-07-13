import { CandidateListResponse, SearchSession, SearchStatus } from './types';

const API_BASE = (() => {
  if (typeof window === 'undefined') return '/api';
  // Desktop app: PyWebview serves the SPA from the backend on the same random
  // port. Use same-origin /api so requests reach the actual backend.
  if (typeof (window as any).pywebview?.api !== 'undefined') return '/api';
  // When served by the backend static handler (typically :8000), use same-origin.
  if (window.location.port === '8000') return '/api';
  // Vite dev server (5173) — talk to the backend directly.
  return 'http://127.0.0.1:8000/api';
})();

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = 15000
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function createSearch(
  prompt: string,
  city: string = "",
  categories: string[] = [],
  searchMode: "ru" | "global" | "telegram" = "ru"
): Promise<SearchSession> {
  return fetchJson<SearchSession>(
    `${API_BASE}/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, city, categories, search_mode: searchMode }),
    },
    20000
  );
}

export async function getSearchStatus(sessionId: number): Promise<SearchStatus> {
  return fetchJson<SearchStatus>(`${API_BASE}/search/${sessionId}/status`, {}, 15000);
}

export async function getSearchSession(sessionId: number): Promise<SearchSession> {
  return fetchJson<SearchSession>(`${API_BASE}/search/${sessionId}`, {}, 20000);
}

export async function cancelSearch(sessionId: number): Promise<{ status: string }> {
  return fetchJson<{ status: string }>(
    `${API_BASE}/search/${sessionId}/cancel`,
    { method: 'POST' },
    15000
  );
}

export async function getSessions(): Promise<SearchSession[]> {
  return fetchJson<SearchSession[]>(`${API_BASE}/sessions`, {}, 15000);
}

export async function getCandidates(
  sessionId: number,
  offset: number = 0,
  limit: number = 50,
  selected: boolean | null = null,
  ready: boolean | null = null,
  sort: 'date' | 'source' | 'location' | 'id' = 'id'
): Promise<CandidateListResponse> {
  const params = new URLSearchParams();
  params.set('offset', String(offset));
  params.set('limit', String(limit));
  if (selected !== null) params.set('selected', String(selected));
  if (ready !== null) params.set('ready', String(ready));
  if (sort) params.set('sort', sort);

  return fetchJson<CandidateListResponse>(
    `${API_BASE}/search/${sessionId}/candidates?${params.toString()}`,
    {},
    15000
  );
}
