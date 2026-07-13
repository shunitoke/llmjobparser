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
    const result = await api.setKey(key);
    if (result.status === 'ok') {
      setStatus('ok');
      setKey('');
      onSaved?.();
    } else {
      setStatus('error');
      setMessage(result.message || 'Не удалось сохранить ключ');
    }
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
