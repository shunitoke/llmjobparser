import { ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ApiKeySettings } from './ApiKeySettings';
import { getDesktopApi } from '@/lib/desktop';

export function FirstRunKeyPrompt({ onSaved }: { onSaved: () => void }) {
  const openExternal = (url: string) => {
    const api = getDesktopApi();
    if (api?.openExternalLink) {
      api.openExternalLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
              JR
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">
              JOB <span className="text-primary">RADAR</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Добавьте ключ GigaChat</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Job Radar использует GigaChat от Сбера для анализа вакансий. Вам нужен личный Authorization key — он бесплатный и хранится только на этом компьютере.
            </p>
          </div>

          <div className="rounded-lg border border-input/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                Зайдите в{' '}
                <button
                  type="button"
                  onClick={() => openExternal('https://developers.sber.ru/')}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  личный кабинет GigaChat
                  <ExternalLink className="h-3 w-3" />
                </button>
              </li>
              <li>Создайте проект или откройте существующий</li>
              <li>
                Скопируйте <strong className="text-foreground">Authorization key</strong>
              </li>
              <li>Вставьте его ниже и нажмите «Продолжить»</li>
            </ol>
          </div>

          <ApiKeySettings onSaved={onSaved} />

          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-primary">
              Что делать, если нет ключа?
            </summary>
            <p className="mt-2">
              Authorization key выдаётся после регистрации в программе GigaChat. Это не логин/пароль от Сбера, а отдельный API-ключ для разработчиков.
            </p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
