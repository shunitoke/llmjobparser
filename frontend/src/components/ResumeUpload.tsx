import { useRef, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ResumeUploadProps {
  onParsed: (searchPrompt: string) => void;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export function ResumeUpload({ onParsed }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Поддерживаются PDF, DOC, DOCX, TXT');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой (макс. 5 МБ)');
      return;
    }
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Сначала добавьте ключ GigaChat в настройках');
        }
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const prompt =
        data.search_prompt ||
        (data.position ? `Вакансии по резюме: ${data.position}` : '');
      if (!prompt) {
        throw new Error('Не удалось извлечь поисковый запрос из резюме');
      }
      onParsed(prompt);
    } catch (e) {
      setError((e as Error).message);
      setFileName(null);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          {loading ? 'Читаем резюме…' : 'Загрузить резюме'}
        </Button>
        {fileName && (
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
            {fileName}
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
