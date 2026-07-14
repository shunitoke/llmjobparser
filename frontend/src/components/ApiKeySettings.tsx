import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDesktopApi, waitForDesktopApi } from '@/lib/desktop';

type Provider = 'gigachat' | 'openai' | 'openrouter' | 'anthropic' | 'deepseek' | 'gemini';

type LlmConfig = {
  provider: Provider;
  model: string;
  has_key: boolean;
};

type ApiKeySettingsProps = {
  onSaved?: () => void;
  onDeleted?: () => void;
};

const FALLBACK_MODELS: Record<Provider, string> = {
  gigachat: 'GigaChat',
  openai: 'gpt-4o-mini',
  openrouter: 'openai/gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  deepseek: 'deepseek-v4-flash',
  gemini: 'gemini-2.0-flash',
};

const PROVIDER_LABELS: Record<Provider, string> = {
  gigachat: 'GigaChat (Сбер)',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic Claude',
  deepseek: 'DeepSeek',
  gemini: 'Google Gemini',
};

const PROVIDER_DESCRIPTIONS: Record<Provider, string> = {
  gigachat: 'Бесплатный ключ от Сбера. Требуется регистрация в SberStudio.',
  openai: 'API-ключ от OpenAI.',
  openrouter: 'Универсальный шлюз: Claude, Gemini, DeepSeek и 300+ моделей.',
  anthropic: 'API-ключ от Anthropic. Claude — мощная модель для анализа текста.',
  deepseek: 'Китайская LLM с очень низкими ценами. OpenAI-совместимый API.',
  gemini: 'Google Gemini — дешёвая и быстрая модель с бесплатным тарифом.',
};

const PROVIDER_KEY_LABELS: Record<Provider, string> = {
  gigachat: 'Authorization key GigaChat',
  openai: 'API-ключ OpenAI (sk-...)',
  openrouter: 'API-ключ OpenRouter',
  anthropic: 'API-ключ Anthropic (sk-ant-...)',
  deepseek: 'API-ключ DeepSeek',
  gemini: 'API-ключ Google AI Studio',
};

const PROVIDER_KEY_PLACEHOLDERS: Record<Provider, string> = {
  gigachat: 'Вставьте ключ из личного кабинета Сбера',
  openai: 'sk-...',
  openrouter: 'Вставьте API-ключ OpenRouter',
  anthropic: 'sk-ant-...',
  deepseek: 'sk-...',
  gemini: 'AIza...',
};

export function ApiKeySettings({ onSaved, onDeleted }: ApiKeySettingsProps) {
  const [provider, setProvider] = useState<Provider>('gigachat');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [showModelField, setShowModelField] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const detectModels = async (p: Provider, k: string) => {
    if (p === 'gigachat') {
      setAvailableModels(['GigaChat']);
      setModel('GigaChat');
      return;
    }
    if (!k) return;
    setDetecting(true);
    try {
      const res = await fetch('/api/settings/llm-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p, api_key: k }),
      });
      const data = await res.json();
      if (data.models?.length) {
        setAvailableModels(data.models);
        setModel(data.default || data.models[0]);
      }
    } catch {
      setModel(FALLBACK_MODELS[p]);
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let p = 'gigachat';
      try {
        const cfgRes = await fetch('/api/settings/llm-config');
        const cfg: LlmConfig = await cfgRes.json();
        if (!cancelled) {
          p = cfg.provider || 'gigachat';
          setProvider(p as Provider);
          setModel(cfg.model || '');
          setHasStoredKey(cfg.has_key);
        }
      } catch {}

      const api = getDesktopApi() ?? (await waitForDesktopApi());
      let storedKey = '';
      if (api) {
        try {
          storedKey = (await api.getStoredKey().catch(() => null)) || '';
          if (!cancelled && storedKey) setKey(storedKey);
        } catch {}
      }

      if (!cancelled) setLoadingConfig(false);

      if (p !== 'gigachat' && storedKey) {
        await detectModels(p as Provider, storedKey);
      } else if (p === 'gigachat') {
        setModel('GigaChat');
        setAvailableModels(['GigaChat']);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    const api = getDesktopApi() ?? (await waitForDesktopApi());
    setStatus('saving');

    if (api && key) {
      const settled = await api.setKey(key);
      if (settled.status !== 'ok') {
        setStatus('error');
        setMessage(settled.message || 'Не удалось сохранить ключ');
        return;
      }
    }

    const modelToSave = model || (await (async () => {
      try {
        const r = await fetch('/api/settings/llm-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, api_key: key }),
        });
        const d = await r.json();
        return d.default || FALLBACK_MODELS[provider];
      } catch { return FALLBACK_MODELS[provider]; }
    })());

    try {
      const res = await fetch('/api/settings/llm-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: key, model: modelToSave }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      if (provider === 'gigachat' && key) {
        await fetch('/api/settings/gigachat-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        }).catch(() => {});
      }
    } catch (e) {
      setStatus('error');
      setMessage('Не удалось сохранить настройки: ' + (e as Error).message);
      return;
    }

    setModel(modelToSave);
    setStatus('ok');
    setHasStoredKey(true);
    onSaved?.();
  };

  const handleDelete = async () => {
    const api = getDesktopApi() ?? (await waitForDesktopApi());
    setStatus('saving');
    try {
      if (api) {
        const localRes = await api.deleteKey();
        if (localRes.status !== 'ok') {
          throw new Error(localRes.message || 'Не удалось удалить ключ');
        }
      }
      const backendRes = await fetch('/api/settings/gigachat-key', { method: 'DELETE' });
      if (!backendRes.ok) {
        const body = await backendRes.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${backendRes.status}`);
      }
      setKey('');
      setModel('');
      setAvailableModels([]);
      setHasStoredKey(false);
      setStatus('ok');
      onDeleted?.();
    } catch (e) {
      setStatus('error');
      setMessage('Не удалось удалить ключ: ' + (e as Error).message);
    }
  };

  const handleProviderChange = async (v: Provider) => {
    setProvider(v);
    setModel('');
    setAvailableModels([]);
    setShowModelField(false);
    await detectModels(v, key);
  };

  const canSave = key.trim().length > 0 && status !== 'saving';
  const displayModel = model || (availableModels[0] || FALLBACK_MODELS[provider]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="llm-provider">Провайдер</Label>
        <select
          id="llm-provider"
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as Provider)}
          disabled={loadingConfig}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {Object.entries(PROVIDER_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{PROVIDER_DESCRIPTIONS[provider]}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="llm-key">{PROVIDER_KEY_LABELS[provider]}</Label>
        <div className="relative">
          <Input
            id="llm-key"
            type={showKey ? 'text' : 'password'}
            placeholder={loadingConfig ? 'Загружаем…' : PROVIDER_KEY_PLACEHOLDERS[provider]}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={loadingConfig}
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10 text-muted-foreground"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}
            disabled={loadingConfig}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {(key.trim() && !detecting && provider !== 'gigachat') && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => detectModels(provider, key)}
          >
            <RefreshCw className="h-3 w-3" />
            Проверить доступные модели
          </button>
        )}
        {detecting && (
          <p className="text-xs text-muted-foreground">Определение модели...</p>
        )}
      </div>

      {provider !== 'gigachat' && (
        <div className="space-y-1">
          <Label>Модель</Label>
          <div className="flex items-center gap-2 text-sm">
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{displayModel}</code>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => setShowModelField((v) => !v)}
            >
              {showModelField ? 'скрыть' : 'изменить'}
            </button>
          </div>
          {showModelField && (
            <Input
              id="llm-model"
              type="text"
              placeholder={availableModels[0] || FALLBACK_MODELS[provider]}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loadingConfig}
              className="mt-2"
            />
          )}
        </div>
      )}

      {status === 'error' && <p className="text-sm text-destructive">{message}</p>}
      {status === 'ok' && <p className="text-sm text-primary">Настройки сохранены</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={!canSave}>
          {status === 'saving' ? 'Сохранение…' : 'Сохранить'}
        </Button>
        {hasStoredKey && (
          <Button variant="outline" onClick={handleDelete} disabled={status === 'saving'}>
            <Trash2 className="mr-2 h-4 w-4" />
            Удалить ключ
          </Button>
        )}
      </div>
    </div>
  );
}
