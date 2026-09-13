# Ashvale — notes for Claude

Weekly compliance dashboard for a UK construction company, pulling inspection data from the
SafetyCulture API. See `README.md` for setup/deployment ops (env vars, local dev commands,
Vercel checklist). This file is about the domain logic and feature history — what's been
built, why, and what to watch out for.

## The core problem this app solves

Every site should get certain inspections done weekly (LOLER lifting-gear checks, PUWER
equipment checks, HAVS, toolbox talks, etc.). The Dashboard shows, per site per week, which
of those are done/overdue/missing. The hard part isn't fetching the data — it's that
SafetyCulture's raw audit data is messy and the naive "was at least one audit submitted"
check hides real gaps. Most of the work in this repo is closing those gaps, one real example
at a time — every fix below was verified against actual live SafetyCulture data before
shipping, not just synthetic tests.

## Key concepts in `app.py`

- **`TEMPLATES`**: SafetyCulture template ID → internal type key. Note EXCAVATOR and DUMPER
  each map from *two* template IDs (normal + a "large site daily checksheet" variant) — both
  satisfy the same column.
- **`PUWER_COLUMNS`**: one PUWER_REGISTER submission covers 5 display columns (PUWER,
  EXCAVATOR, DUMPER, ROLLER, TELEHAND) — but see "N/A status" below, it's not unconditional.
- **`INDIVIDUAL_COVERABLE`**: EXCAVATOR/DUMPER/ROLLER/TELEHAND also have their own individual
  per-machine audit template, separate from PUWER_REGISTER.
- **Serial extraction** (`extract_serials`, `PREFIX_TYPE`, `_implied_prefix_serials`): plant
  equipment serials appear in inspection text either explicitly prefixed (`ASH205`, `ROR 17`)
  or as bare numbers where the *item's own question* implies the category (a PUWER Register
  "Excavator" item just says "205, 1420, 834" — no prefix). `_implied_prefix_serials` is the
  shared helper for the bare-number case; `extract_puwer_item_serials`/`extract_loler_item_serials`
  are thin wrappers with each form's own label→prefix mapping (`PUWER_IMPLIED_PREFIX`,
  `LOLER_ITEM_KEYWORDS`). Some equipment categories (Concrete Pouring Bucket, Lifting Straps,
  Harness, Pedestrian/Trench Roller) use codes the app has never recognized — deliberately
  left unmapped rather than guessed at.
- **`extract_machine_id`**: individual EXCAVATOR/DUMPER/ROLLER/TELEHAND audit titles follow
  `"DATE / SERIAL / SITE NAME"`. Only the middle segment is ever scanned — the site-name
  segment can collide with a serial prefix (e.g. job code "BG218" vs. LOLER prefix "BG").

## Feature history (why things look the way they do)

1. **Site roster** (`ManageSites.tsx`) — the Dashboard shows sites the user has explicitly
   added (Excel upload or manual), not "whoever SafetyCulture happened to have data for."
2. **Machine counting** (`machines_checked`, `individual_audits`) — checking "was at least
   one excavator inspected" isn't enough; a site can have 8 excavators and only 1 got
   checked. Every individual audit's machine serial is now tracked, not just "was one done."
   The Dashboard's status cell opens a picker (`AuditPicker.tsx`, shared by `StatusCell` and
   `SiteCard`) when a column covers more than one audit for the week.
3. **PUWER cross-check** (`puwer_cross_check`) — PUWER Register's own item text lists
   machines too. Cross-checking it against what the individual audits actually found catches
   real contradictions (a live example: BG218 site, register said one machine, individual
   audits found another). Flags **both** directions (in register-not-individual, and
   vice versa) — this was an explicit user correction earlier, don't flag just one side.
4. **Photo-instead-of-data detection** (`puwer_photo_uploaded`, `loler_report_uploaded`) —
   some sites attach a photo of the report instead of typing serials into the checklist.
   Technically fetchable via `item["media"]` but **not OCR'd** (no Tesseract on Vercel
   serverless, cloud OCR = new paid dependency with uncertain accuracy on equipment tags) —
   flagged as "not auto-verified" instead, rather than guessing or showing a false gap.
5. **LOLER vs. plant register** — LOLER has no per-machine individual audit (one combined
   form covers all lifting gear), so only "LOLER vs. the whats-where PDF" applies. Needed the
   same bare-number/implied-prefix parsing as PUWER once real data showed LOLER item text
   also lists serials as bare numbers per category (chain/shackle/fork/block grab/tipping skip).
6. **N/A status** (`status: "n/a"`) — found via a real example (AB0023 Rabans Lane's
   TELEHAND showing a false green tick sourced from a PUWER Register entry that actually
   answered "N/A" for telehandler, i.e. the site has none). PUWER Register unconditionally
   marked all 5 of its columns "done" regardless of per-category N/A answers — now a
   category answered N/A gets its own neutral status, doesn't count against compliance, and
   `computeNotes()` (frontend) cross-checks it against the uploaded plant register PDF in
   case the register contradicts the N/A claim.
7. **Excel export parity** — `generate_report()` (the `/generate` Excel export) has its own
   independent audit-fetching/parsing code, separate from `build_dashboard_data()`. Every
   backend parsing fix above had to be applied there too, or the Excel Notes column silently
   ran stale logic while the Dashboard showed the fix. Check both places when touching
   serial-extraction logic.

## Known gotchas

- **Shared dev cache pollution**: `_CACHE_FILE` lives at a fixed path in the OS temp dir
  (`%TEMP%\ashvale_dashboard_cache.json` on Windows). Tests that call `build_dashboard_data(force_refresh=True)`
  with mocked `sc.search_audits`/`fetch_audits_parallel` (e.g. `test_puwer_photo_only.py`)
  write their **fake** data into this same file. If a local dev server is also running, it'll
  serve that stale fake data for up to an hour. Delete the cache file before manually
  verifying against a live local server after running the test suite.
- **`StatusCell.tsx` vs `SiteCard` (in `Sites.tsx`)**: two separate components render the
  same per-column status (desktop table vs. mobile card grid). They don't share rendering
  code beyond `AuditPicker.tsx` (the multi-audit modal) and `STATUS_COLORS` — if you add a
  new status or field, check both.
- **No browser automation available** in this environment — frontend changes are verified via
  `npm run build`/`tsc` type-checking, code review, and API-level curl checks against a local
  Flask server, not actual browser interaction. Disclose this as a limitation when relevant.

## Conventions

- **Tests**: plain `test_*.py` files in repo root, no framework, run via `python test_X.py`,
  asserting against real-data-shaped mocks (not just synthetic edge cases). Every new
  non-trivial parsing/logic change gets one.
- **Verification ritual before shipping a change**: syntax-check → run full `test_*.py` suite
  → (if frontend touched) `npm run build` → restart local Flask dev server → curl-verify
  locally against real data → commit → push → `vercel deploy --prod` → curl-verify production
  (`https://ashvale-gamma.vercel.app/api/health`, then the actual endpoint touched).
- **Real-data-driven development**: prefer confirming a fix against actual live SafetyCulture
  data for a real site over trusting a synthetic test alone — most bugs in this app were only
  visible once real inspection text/titles were inspected.
