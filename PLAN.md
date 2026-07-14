# vibejob implementation plan

## Branches / locations
- Backend changes: `D:\_projects\Repos\llmjobparser` (main).
- Frontend redesign changes: `D:\_projects\Repos\llmjobparser\.worktrees\job-radar-redesign`.
- After completion the redesign worktree will be merged into main by the user.

## Phase 1 — Backend (main)
1. **Dates in parsers**
   - HH `get_vacancy_details`: parse `published_at` from detail page.
   - Rabota `get_vacancy_details`: parse from LD+JSON `datePosted`.
   - SuperJob `get_vacancy_details`: parse from meta/time.
   - RemoteOK `search_vacancies`: include date field from API response.
   - WWR `_fetch_feed_items`: parse `<pubDate>`.
   - 4DayWeek `_fetch_jobs`: include `published_at`.
   - Djinni `get_vacancy_details`: parse date from meta/time.
   - Telegram already has date.
   - Normalize string dates to `datetime` in `search_service.py` before creating `Job`.
2. **Fix Djinni parser**
   - Inspect live page, update selectors/headers, ensure non-empty results for typical queries.
3. **Fix 4DayWeek relevance**
   - Verify `?search=` API behaviour; strengthen `_matches_query` so the main query term must be present.
4. **Source health endpoint**
   - Add `GET /api/sources/health` in `main.py`.
   - Probe each source with 3–5 s timeout, cache 60 s.
5. **Search algorithm tweaks**
   - Replace integer division with `ceil` for per-source allocation.
   - Strengthen term matching for global sources.
   - Add deduplication by normalized `title + company`.
6. **Tests**
   - Add `backend/tests/test_parsers_smoke.py`.
   - Run `python -m unittest discover backend/tests`.

## Phase 2 — Frontend (worktree)
1. **Brand & assets**
   - Create `frontend/public/vibejob-icon.svg` and `vibejob-favicon.svg`.
   - Update `index.html` title/favicon and `package.json` name.
   - Replace visible "Job Radar" / "LLM Job Parser" strings with "vibejob".
2. **Source health UI**
   - Add `useSourceHealth` hook calling `/api/sources/health`.
   - Add header trigger and drawer/sheet listing sources with status dots + VPN note.
3. **Layout redesign**
   - Convert `App.tsx` to single-column layout.
   - Remove map iframe and location pins.
   - Replace `StatusPanel` card with thin stepper + single progress bar.
   - Replace separate matched/unmatched lists with tabs.
   - Move raw candidate list to bottom accordion (`Collapsible`/`Accordion`).
   - Remove "В работе" filter, keep "Все / Отобранные".
4. **Cards**
   - Add relative date formatting helper.
   - Show relative date chip in `JobCard` and `CandidateCard`.
   - Remove full green background, use left-border accent for matches.
5. **Sort**
   - Add "по релевантности" as default sort option.
   - Apply sort to all tabs.
6. **Logos**
   - Add Djinni and 4DayWeek logos to `SourceLogos.tsx`.

## Phase 3 — Verification
- `python -m unittest discover backend/tests`
- Parser smoke tests (live, small `max_results`)
- `npx tsc --noEmit` in worktree
- `npm run build` in worktree
- Manual run via `start-redesign.ps1` if possible
