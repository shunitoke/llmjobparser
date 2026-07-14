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
                <a href="https://t.me/fastmvpbot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline" title="Telegram">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.127.037.358.029.536-.076 3.834-.405 8.097-.572 9.653-.072.662-.213.884-.35 1.042-.296.34-.624.358-1.04.222-.64-.214-3.443-2.21-4.724-3.162h-.001l-.687-.54c-.424-.34-.148-1.03.186-1.317l.018-.014 3.086-2.979c.38-.374.076-.566-.15-.446l-3.947 2.524c-.058.036-.17.093-.298.096a.56.56 0 0 1-.316-.106c-.425-.317-1.222-.795-1.628-1.043-.143-.087-.377-.293-.13-.578.1-.114.275-.232.472-.353l7.396-4.683c.079-.044.337-.139.538-.148z"/></svg>
                  @fastmvpbot
                </a>
                <span className="mx-2">·</span>
                <a href="https://github.com/shunitoke/llmjobparser" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline" title="GitHub">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                  GitHub
                </a>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
