export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 28 28" className="h-7 w-7" fill="none" aria-hidden="true">
        <circle cx="13" cy="13" r="9" stroke="currentColor" strokeWidth="2" />
        <circle cx="13" cy="13" r="5" stroke="currentColor" strokeWidth="1.25" opacity="0.5" />
        <circle cx="13" cy="13" r="2" fill="currentColor" className="text-primary" />
        <path d="M20 20l5 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      </svg>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-lg font-semibold tracking-tight text-foreground">vibe</span>
        <span className="text-lg font-semibold tracking-tight text-primary">job</span>
      </div>
    </div>
  );
}
