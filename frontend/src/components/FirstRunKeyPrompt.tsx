import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiKeySettings } from './ApiKeySettings';
import { ResumeUpload } from './ResumeUpload';
import { getDesktopApi } from '@/lib/desktop';

export function FirstRunKeyPrompt({ onSaved }: { onSaved: (resumePrompt?: string) => void }) {
  const [step, setStep] = useState<'key' | 'resume'>('key');
  const [resumePrompt, setResumePrompt] = useState('');

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
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="14" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <circle cx="14" cy="14" r="2.5" fill="currentColor" />
                <path d="M21.5 21.5 L28 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">
              <span className="text-foreground">vibe</span>
              <span className="text-primary">job</span>
            </div>
          </div>

          {step === 'key' ? (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Настройте API</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  vibejob использует нейросеть для анализа вакансий. Вы можете использовать GigaChat (бесплатно), OpenAI или OpenRouter.
                  Ключ хранится только на этом компьютере.
                </p>
              </div>

              <ApiKeySettings onSaved={() => setStep('resume')} />

              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer font-medium text-primary">Где взять ключ?</summary>
                <div className="mt-2 space-y-2">
                  <p>
                    <strong>GigaChat</strong> — бесплатный ключ после регистрации в{' '}
                    <button
                      type="button"
                      onClick={() => openExternal('https://developers.sber.ru/studio/login')}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      SberStudio
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </p>
                  <p>
                    <strong>OpenAI</strong> —{' '}
                    <button
                      type="button"
                      onClick={() => openExternal('https://platform.openai.com/api-keys')}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      получить API-ключ
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </p>
                  <p>
                    <strong>OpenRouter</strong> —{' '}
                    <button
                      type="button"
                      onClick={() => openExternal('https://openrouter.ai/keys')}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      получить API-ключ
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    (Claude, DeepSeek, Gemini и 300+ моделей)
                  </p>
                  <p>
                    <strong>Anthropic Claude</strong> —{' '}
                    <button
                      type="button"
                      onClick={() => openExternal('https://console.anthropic.com/settings/keys')}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      получить API-ключ
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </p>
                </div>
              </details>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Ключ сохранён</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Можете сразу загрузить резюме — vibejob подберёт подходящий поисковый запрос. Или нажмите «Пропустить».
                </p>
              </div>

              <ResumeUpload onParsed={(p) => setResumePrompt(p)} />

              {resumePrompt && (
                <div className="rounded-lg border border-input/60 bg-muted/40 p-3 text-sm">
                  <p className="text-muted-foreground">Сгенерирован запрос:</p>
                  <p className="mt-1 font-medium">{resumePrompt}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onSaved()} className="flex-1">
                  Пропустить
                </Button>
                <Button onClick={() => onSaved(resumePrompt)} className="flex-1">
                  Начать поиск
                </Button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Автор: <a href="https://t.me/fastmvpbot" target="_blank" rel="noopener noreferrer" className="hover:underline">@fastmvpbot</a>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
