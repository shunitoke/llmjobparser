export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="14" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <circle cx="14" cy="14" r="2.5" fill="currentColor" />
          <path d="M21.5 21.5 L28 28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold tracking-tight">
          <span className="text-foreground">vibe</span>
          <span className="text-primary">job</span>
        </div>
        <div className="text-xs text-muted-foreground">Умный поиск работы</div>
      </div>
    </div>
  );
}
