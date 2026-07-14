import { useRef, useState } from 'react';
import { FileUp, Loader2, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [showParsed, setShowParsed] = useState(false);

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
    setParsedData(null);
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
      setShowParsed(true);
      const prompt = data.search_prompt || (data.position ? `Вакансии по резюме: ${data.position}` : '');
      if (prompt) onParsed(prompt);
    } catch (e) {
      setError((e as Error).message);
      setFileName(null);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleTextParse = async () => {
    if (!textValue.trim()) return;
    setLoading(true);
    setError(null);
    setParsedData(null);
    try {
      const res = await fetch('/api/resume/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textValue }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || `HTTP ${res.status}`);
      }
      const data: ParsedData = await res.json();
      setParsedData(data);
      setShowParsed(true);
      const prompt = data.search_prompt || (data.position ? `Вакансии по резюме: ${data.position}` : '');
      if (prompt) onParsed(prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setFileName(null);
    setError(null);
    setParsedData(null);
    setShowParsed(false);
    setTextValue('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-0.5" role="tablist" aria-label="Способ ввода резюме">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'file'}
            onClick={() => setMode('file')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'file' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Файл
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            onClick={() => setMode('text')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'text' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Текст
          </button>
        </div>
      </div>

      {mode === 'file' ? (
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              {loading ? 'Читаем резюме…' : 'Загрузить резюме'}
            </Button>
            {fileName && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs">
                {fileName}
                <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground" aria-label="Очистить">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Вставьте текст резюме целиком…"
            rows={4}
            disabled={loading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleTextParse} disabled={loading || !textValue.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? 'Анализируем…' : 'Проанализировать'}
            </Button>
            {textValue && !loading && (
              <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground">
                Очистить
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {parsedData && (
        <div className="rounded-lg border border-input/60 bg-muted/30">
          <button
            type="button"
            onClick={() => setShowParsed((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
          >
            <span>Данные из резюме</span>
            {showParsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showParsed && (
            <div className="space-y-2 border-t px-3 py-2 text-xs">
              {parsedData.position && (
                <p><span className="text-muted-foreground">Должность:</span> {parsedData.position}</p>
              )}
              {parsedData.skills?.length > 0 && (
                <p><span className="text-muted-foreground">Навыки:</span> {parsedData.skills.join(', ')}</p>
              )}
              {parsedData.experience_summary && (
                <p><span className="text-muted-foreground">Опыт:</span> {parsedData.experience_summary}</p>
              )}
              {parsedData.search_prompt && (
                <p><span className="text-muted-foreground">Сформирован запрос:</span> {parsedData.search_prompt}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Загрузите резюме или вставьте его текст — нейросеть выделит навыки и опыт, чтобы точнее подбирать вакансии под вас. Найденные вакансии сразу фильтруются по релевантности.
        </span>
      </div>
    </div>
  );
}
