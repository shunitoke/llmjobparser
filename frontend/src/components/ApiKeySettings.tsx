import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDesktopApi } from '@/lib/desktop';

export function ApiKeySettings({ onSaved }: { onSaved?: () => void }) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    const api = getDesktopApi();
    if (!api) return;
    setStatus('saving');
    // 1. Persist the key locally (keyring/DPAPI) so it survives restarts.
    const settled = await api.setKey(key);
    if (settled.status !== 'ok') {
      setStatus('error');
      setMessage(settled.message || 'Не удалось сохранить ключ');
      return;
    }
    // 2. Push the key to the running backend so the key_manager learns it
    //    without requiring a restart. Same-origin /api is correct in desktop mode
    //    (the SPA is served by the backend itself).
    try {
      const res = await fetch('/api/settings/gigachat-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
    } catch (e) {
      // Local storage succeeded, but the live backend did not accept it. The
      // user can restart the app; meanwhile surface the issue.
      setStatus('error');
      setMessage('Ключ сохранён, но не передан в бэкенд: ' + (e as Error).message);
      return;
    }

    setStatus('ok');
    setKey('');
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gigachat-key">Authorization key GigaChat</Label>
        <Input
          id="gigachat-key"
          type="password"
          placeholder="Вставьте ключ из личного кабинета Сбера"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Ключ хранится только на этом компьютере и не отправляется никуда, кроме API GigaChat.
        </p>
      </div>
      {status === 'error' && <p className="text-sm text-destructive">{message}</p>}
      {status === 'ok' && <p className="text-sm text-primary">Ключ сохранён</p>}
      <Button onClick={handleSave} disabled={!key.trim() || status === 'saving'}>
        {status === 'saving' ? 'Сохранение…' : 'Сохранить'}
      </Button>
    </div>
  );
}