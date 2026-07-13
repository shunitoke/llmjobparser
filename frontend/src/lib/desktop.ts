export interface DesktopApi {
  getKeyStatus: () => Promise<{ configured: boolean }>;
  setKey: (key: string) => Promise<{ status: 'ok' | 'error'; message?: string }>;
  openExternalLink: (url: string) => void;
}

declare global {
  interface Window {
    pywebview?: {
      api: DesktopApi;
    };
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.pywebview?.api;

export const getDesktopApi = (): DesktopApi | null => window.pywebview?.api ?? null;
