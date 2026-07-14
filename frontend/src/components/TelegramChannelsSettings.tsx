import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Channel {
  name: string;
}

export function TelegramChannelsSettings() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/settings/telegram-channels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Не удалось загрузить каналы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (next: Channel[]) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/telegram-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChannels(data.channels);
    } catch (e) {
      setError('Не удалось сохранить каналы');
    } finally {
      setSaving(false);
    }
  };

  const addChannel = () => {
    const name = newName.trim().replace(/^@/, '');
    if (!name) {
      setError('Введите имя канала');
      return;
    }
    if (channels.some((c) => c.name === name)) {
      setError('Канал уже есть в списке');
      return;
    }
    setError(null);
    const next = [...channels, { name }];
    setNewName('');
    save(next);
  };

  const removeChannel = (name: string) => {
    const next = channels.filter((c) => c.name !== name);
    save(next);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Добавьте каналы Telegram в формате @channel.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаем каналы…
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {channels.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2"
              >
                <p className="min-w-0 truncate text-sm font-medium">@{c.name}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-destructive"
                  onClick={() => removeChannel(c.name)}
                  disabled={saving}
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {channels.length === 0 && (
              <li className="text-sm text-muted-foreground">Каналы не настроены.</li>
            )}
          </ul>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="tg-name">Канал</Label>
              <Input
                id="tg-name"
                placeholder="@channel или channel"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                disabled={saving}
              />
            </div>
            <Button onClick={addChannel} disabled={saving || !newName.trim()} className="self-end">
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
