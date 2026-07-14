import { useRef, useState, useEffect } from 'react';
import { FileUp, Loader2, X, ChevronDown, ChevronUp, Check, Type } from 'lucide-react';
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

interface ParsedData {
  position: string;
  skills: string[];
  experience_summary: string;
  search_prompt: string;
}

export function ResumeUpload({ onParsed }: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (parsedData || loading || textMode) return;
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.length > 30) {
        e.preventDefault();
        handleTextParse(text);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [parsedData, loading, textMode]);

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
    setParsedData(null);
    setTextMode(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) throw new Error('Сначала добавьте ключ GigaChat в настройках');
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data: ParsedData = await res.json();
      setParsedData(data);
      setExpanded(false);
      const prompt = data.search_prompt || (data.position ? `Вакансии по резюме: ${data.position}` : '');
      if (prompt) onParsed(prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleTextParse = async (text: string) => {
    setLoading(true);
    setError(null);
    setParsedData(null);
    try {
      const res = await fetch('/api/resume/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data: ParsedData = await res.json();
      setParsedData(data);
      setExpanded(false);
      setTextMode(false);
      setTextValue('');
      const prompt = data.search_prompt || (data.position ? `Вакансии по резюме: ${data.position}` : '');
      if (prompt) onParsed(prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setError(null);
    setParsedData(null);
    setExpanded(false);
    setTextMode(false);
    setTextValue('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      {!parsedData && !loading && !textMode && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="flex items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/30"
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
          >
            <FileUp className="h-4 w-4" />
            Загрузить резюме
          </button>
          <span className="text-xs text-muted-foreground/30">|</span>
          <button
            type="button"
            onClick={() => { setTextMode(true); setTimeout(() => textareaRef.current?.focus(), 0); }}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Type className="h-3.5 w-3.5" />
            <span>Вставить текст</span>
          </button>
          <span className="text-xs text-muted-foreground/50">(или вставьте из буфера)</span>
        </div>
      )}

      {!parsedData && !loading && textMode && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setTextMode(false)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <FileUp className="h-3.5 w-3.5" />
            Загрузить файл
          </button>
          <textarea
            ref={textareaRef}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Вставьте текст резюме целиком…"
            rows={4}
            disabled={loading}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => handleTextParse(textValue)} disabled={loading || !textValue.trim()}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {loading ? 'Анализируем…' : 'Анализировать'}
            </Button>
            <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading && !textMode && (
        <div className="rounded-xl border-2 border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
          <Loader2 className="mr-1.5 inline-block h-4 w-4 animate-spin" />
          Анализируем резюме…
        </div>
      )}

      {parsedData && (
        <div className="overflow-hidden rounded-xl border">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/30"
          >
            <Check className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium">{parsedData.position || 'Резюме'}</span>
            {parsedData.skills.length > 0 && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="shrink-0 text-muted-foreground">{parsedData.skills.length} навыков</span>
              </>
            )}
            <span className="flex-1" />
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clear(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clear(); } }}
              className="ml-1 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>

          {expanded && (
            <div className="border-t px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              {parsedData.position && (
                <p><span className="text-foreground">Должность:</span> {parsedData.position}</p>
              )}
              {parsedData.skills?.length > 0 && (
                <p><span className="text-foreground">Навыки:</span> {parsedData.skills.join(', ')}</p>
              )}
              {parsedData.experience_summary && (
                <p><span className="text-foreground">Опыт:</span> {parsedData.experience_summary}</p>
              )}
              {parsedData.search_prompt && (
                <p><span className="text-foreground">Запрос:</span> {parsedData.search_prompt}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && !loading && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
