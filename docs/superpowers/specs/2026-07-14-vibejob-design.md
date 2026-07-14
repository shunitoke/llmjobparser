# vibejob — design spec

## Goal
Rebuild the LLM Job Parser frontend (Job Radar) into a minimalistic, single-column app called **vibejob** that matches jobs to a user's lifestyle/vibe, fixes parser reliability, and surfaces source availability.

## Scope
- Rebrand from "LLM Job Parser" / "Job Radar" to **vibejob**.
- Backend: extract `published_at` for every parser, fix broken/weak parsers, add source health probe, tighten search allocation.
- Frontend: single-column layout, hidden-by-default source status, raw-card accordion, relative dates, remove map.

## Name & brand
- Product name: **vibejob**.
- Tagline (optional): "Работа под твой вайб".
- Icon: SVG loupe + radar rings in emerald/cyan.

## Backend design

### Data model
- `Job.published_at` already exists; parsers must populate it.
- Telegram already returns `datetime`; other parsers return `datetime` objects or ISO strings.
- Search service normalizes to `datetime` before persisting.

### Parsers
| Source | `published_at` source | Known issues |
|--------|-----------------------|--------------|
| HH | vacancy detail page: `<meta property="article:published_time">`, `<time>`, or JSON-LD `datePosted` | none critical |
| Rabota.ru | detail page LD+JSON `datePosted` | salary/location weak |
| SuperJob | detail page `meta[property="article:published_time"]` or `<time>` | none critical |
| RemoteOK | API field `date` / `original_date` / timestamp (inspect live) | none critical |
| We Work Remotely | RSS `<pubDate>` | none critical |
| 4DayWeek | API `published_at` | client-side matching too loose |
| Djinni.co | detail page `<time>` or `meta` | currently returns 0 results |
| Telegram | `<time datetime>` | network blocked in RU |

### Source health endpoint
- `GET /api/sources/health`
- Probes each source with short timeout (3–5 s).
- Returns `{source: "ok" | "slow" | "blocked" | "unknown"}`.
- Cached 60 s.

### Search algorithm tweaks
- Use `ceil` for per-source allocation instead of integer division.
- Strengthen `_matches_query` for global sources (require main term match).
- Deduplicate by normalized `title + company`.

## Frontend design

### Layout
- Single centered column, `max-w-6xl`.
- Header: Logo + theme toggle + "Источники" trigger.
- Search form as a clean command bar.
- Progress: thin horizontal stepper + one progress bar.
- Results: tabs "Подходят / Все / Не подходят".
- Sort: subtle dropdown with options "по релевантности / по дате / по источнику / по адресу".
- Raw cards: collapsible accordion at the bottom, hidden by default.
- Map: removed.

### Vacancy card
- Source badge + relative date chip.
- Title link with external icon.
- Company, location, salary on one line.
- Match reason as a short sentence.
- Expand description button.
- Match state shown by left-border accent or small badge, not full green card background.

### Source status drawer
- Triggered from header.
- List of all sources with colored dots and note.
- "RemoteOK / WWR / 4DayWeek / Djinni / Telegram may require VPN in Russia" warning.

### Dates
- Relative format: "сегодня", "вчера", "3 дня назад", then absolute `dd.mm.yyyy`.
- Used in result cards and raw candidate cards.

### Logos
- Use existing source logos plus new `djinny.png` and `Four-Day-Week-Logo_Pink.png`.

## Verification
- `python -m unittest discover backend/tests` passes.
- Parser smoke tests return structure with `published_at`.
- `npx tsc --noEmit` passes in worktree frontend.
- `npm run build` succeeds in worktree frontend.
