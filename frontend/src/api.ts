import { SearchSession, SearchStatus } from './types';

const API_BASE = '/api';

export async function createSearch(prompt: string, city: string = "", categories: string[] = []): Promise<SearchSession> {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, city, categories }),
  });
  if (!response.ok) throw new Error('Failed to create search');
  return response.json();
}

export async function getSearchStatus(sessionId: number): Promise<SearchStatus> {
  const response = await fetch(`${API_BASE}/search/${sessionId}/status`);
  if (!response.ok) throw new Error('Failed to get status');
  return response.json();
}

export async function getSearchSession(sessionId: number): Promise<SearchSession> {
  const response = await fetch(`${API_BASE}/search/${sessionId}`);
  if (!response.ok) throw new Error('Failed to get session');
  return response.json();
}

export async function getSessions(): Promise<SearchSession[]> {
  const response = await fetch(`${API_BASE}/sessions`);
  if (!response.ok) throw new Error('Failed to get sessions');
  return response.json();
}
