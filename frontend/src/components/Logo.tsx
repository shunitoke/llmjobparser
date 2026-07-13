export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold tracking-tight">
          <span className="text-foreground">JOB</span>{' '}
          <span className="text-primary">RADAR</span>
        </div>
        <div className="text-xs text-muted-foreground">Умный поиск работы</div>
      </div>
    </div>
  );
}
