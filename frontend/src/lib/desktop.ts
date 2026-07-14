export interface DesktopApi {
  getKeyStatus: () => Promise<{ configured: boolean }>;
  setKey: (key: string) => Promise<{ status: 'ok' | 'error'; message?: string }>;
  deleteKey: () => Promise<{ status: 'ok' | 'error'; message?: string }>;
  getStoredKey: () => Promise<string | null>;
  openExternalLink: (url: string) => void;
}

declare global {
  interface Window {
    pywebview?: {
      api: DesktopApi;
    };
  }
}

const isDesktopUrl = (): boolean =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('desktop') === '1';

export const isDesktop = (): boolean =>
  isDesktopUrl() || (typeof window !== 'undefined' && !!window.pywebview?.api);

export const getDesktopApi = (): DesktopApi | null => window.pywebview?.api ?? null;

export function waitForDesktopApi(timeoutMs = 2500): Promise<DesktopApi | null> {
  return new Promise((resolve) => {
    const api = getDesktopApi();
    if (api) {
      resolve(api);
      return;
    }

    let resolved = false;
    const done = (value: DesktopApi | null) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener('pywebviewready', onReady);
      resolve(value);
    };

    const onReady = () => {
      done(getDesktopApi());
    };

    window.addEventListener('pywebviewready', onReady);
    window.setTimeout(() => done(getDesktopApi()), timeoutMs);
  });
}
