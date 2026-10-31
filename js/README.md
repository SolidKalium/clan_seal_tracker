# Browser edition

Vue + TypeScript + Vite, with browser-managed Bungie requests and a Dexie/IndexedDB cache. PHP remains in the repository root.

## Run

From the repository root:

```bash
npm --prefix js ci
npm --prefix js run dev
```

Open **http://localhost:5173/js/** through the dev container's forwarded port 5173. The server binds to `0.0.0.0` and requires port 5173 rather than silently selecting a different origin. If VS Code accepts connections but never forwards them, reload the VS Code window.

The parent `settings.json` must contain `secret_key` and `group_id`. `predev` and `prebuild` compile those two values, the default language, and the page catalog from `js/pages.jsonc` into ignored `.generated/*.json`. Restart dev after changing source settings/content. The rest of the PHP settings and caches are not copied. No JSONC parser is shipped to the browser.

**The Bungie API key is intentionally client-visible** in the dev app and built JavaScript. This does not make the rest of `settings.json` public. Do not use this mechanism for OAuth client secrets or other confidential credentials. A production host must serve only `dist/` under `/js/`, not the repository or generated/source directories.

Bungie must allow the browser's exact origin in the application registration. For normal local use that is `http://localhost:5173`; `http://127.0.0.1:5173` is a different origin. If using a different forwarded address, register that origin instead. Manifest downloads can succeed even while clan/profile endpoints reject the origin. The app displays the registration error and current origin. There is no development proxy masking this requirement.

## Page catalog

Edit `js/pages.jsonc` for the browser site's raid/activity list and display exceptions. It is independent of the root PHP `pages.json`; the compiler no longer reads the old file. Pages are ordered by their position in this array, grouped as `Raid seals` (default) or `Activities`. Use `sealNodeHash`, `badgeNodeHash`, and `otherNodeHashes` for scope, with `records`/`collectibles` for extra full-raid content and supported display/scoring overrides. Element ordering (including Prismatic), day-one exclusions, numbered stages, item groups, and armor slots are derived from the manifest. Recompile with `npm --prefix js run prepare:data`, or restart dev after catalog edits.

Crota's End, Salvation's Edge, and The Desert Perpetual include all three page modes. The Desert Perpetual's Collective Psyche and Wayward Psyche armor sets have separate groups and set-completion tooltips; badge scoring still uses one whole class across the entire badge.

Activity pages use `#/seal/<id>` and `#/triumphs/<id>`. Crucible, Gambit, and Trials also have badge views. Their full triumph lists omit collection badge items, matching the legacy activity-page scope; pages without a badge still work. Gilding requirements retain the API label and legacy scoring (included in the percentage), with an explanatory footer note. Current manifest availability governs all pages; no archived-profile import is needed.

## Included

- Clan from the existing settings file, with a local overview and ten raids with Seal, Badge, and Full raid views, plus six activity seals with Seal/Triumphs views and optional collection badges. Raids and Activities have separate overview sections and navigation groups. The sidebar can collapse to an emblem and vertical clan name; its state persists locally. Cache status and refresh live in the top bar, with an explanatory status-color tooltip.
- Collection badge items, with a best-whole-class default and Titan/Hunter/Warlock selection. Tooltips show each class’s ownership. Armor stays in five compact slot columns.
- Column groups separate triumphs, weapons, patterns, armor, mods, and cosmetics. Collection tooltips show item types, mod perks, and contextual acquisition goals; redundant raid sources are omitted.
- Full raid pages combine seal requirements, extra raid triumphs, configured patterns/mods/collectibles, and badge items. Elemental requirements normalize to Arc, Void, Solar, Stasis, Strand; seal scope follows the manifest, so extra Strand triumphs remain full-raid only. Day-one achievements appear in both triumph views, marked Not scored.
- Generic seal requirements from the active manifest, including account/character records and interval objectives. Missing or unsupported definitions are marked unavailable.
- Progressive per-player updates, name search, complete/incomplete/no-data filters, progress/name/clan-tenure sorting, sticky table headings/names, and objective details on cell selection.
- Title-holder counts with loaded-profile coverage. These include retained older public data; the global stale/private count identifies that limitation.
- Definitions, roster, profiles, and cross-save resolution persist in IndexedDB. Small working maps avoid placing entire response trees in Vue reactivity.
- Filters/sort/search persist separately from API data. Clearing the API cache keeps preferences.
- Compact guardian rows, with clan rank, join date, freshness, and linked platform names in guardian tooltips. Membership names load on demand and are cached for 24 hours. Tooltips let pointer movement pass through to the table.
- Manual refresh, individual retry, bounded profile concurrency, request deduplication, timeouts, throttling/backoff, and fallback to last good data.
- Cache-storage failure falls back to session memory with a visible notice.

## Cache behavior

The cache is domain-controlled rather than driven by HTTP response cache headers. API fetches use `cache: no-store`; immutable definition downloads can still use the HTTP cache. Definitions (presentation nodes, records, objectives, collectibles, inventory item types, and sandbox perks) check every five minutes and replace a complete snapshot atomically. Existing record-only snapshots are upgraded even if the manifest version has not changed. Rosters refresh after three minutes. Profile components 100, 800, and 900 use the legacy activity/five-minute/seven-day policy, plus component coverage checks and a short cooldown after private/error responses. Missing activity timestamps use a conservative five-minute TTL.

A failed fetch never changes the successful-fetch timestamp. Private responses retain any previously public data and mark it explicitly. Refresh forces a new attempt but still honors request throttling. A warm reload can display cached data without a Bungie request. Cache persistence is per origin/browser and may be evicted; the app shell is not yet a service-worker-backed offline app.

## Intentional limits

This slice implements **seal, badge, and full raid modes** for the ten configured raids, plus activity seal/triumph views for Crucible, Iron Banner, Gambit, Trials of Osiris, Strikes, and Weapons/Deadeye. Full raid percentages average the scored record and collection columns equally, including the badge requirement record and its individual items, following the legacy full-page weighting. Progress uses the PHP record-average calculation. Multi-objective triumphs have aligned objective subcolumns, with visible counts for partial objectives; a completed triumph collapses to one checkmark spanning its stages. Hover or keyboard focus opens a styled tooltip, and clicking pins the details below the table. Character records choose the best complete character record by aggregate progress, rather than combining objectives across characters. That is a deliberate clarification of the legacy heuristic. API character storage scope alone does not imply character-specific earning rules, so no blanket per-character label is shown. Title counts respect the completion record's own scope and recognize redemption on any character.

No per-user overrides, frozen profiles, hidden-player rules, clan selector, historical-data import/UI, OAuth, or server rendering. Clan selection follows the port of most current features. Archived datasets stay untouched.

## Verify and build

```bash
npm --prefix js test
npm --prefix js run build
npm --prefix js run test:browser
```

Unit tests include whole-class badge scoring, elemental ordering, day-one exclusions, manifest coverage upgrades, JSONC compilation/allowlisting, cache freshness, stale/private fallback, manifest replacement, persistence, and a comparison against the existing PHP calculation. **PHP CLI is required for that comparison test.**

Playwright uses synthetic API responses to test first/warm loads, failure fallback, navigation, filter/sort persistence, clear-cache behavior, actionable origin errors, and mobile overflow without sending a clan's data to test artifacts. Install its browser/dependencies if needed:

```bash
cd js
npx playwright install chromium
npx playwright install-deps chromium
```

The second command may require root. Chromium is the automated target; real Safari remains a manual acceptance check. Live API access must also be checked separately, because mocked browser tests do not validate Bungie origin registration.

`npm run build` writes an ignored static bundle to `js/dist/`, configured for `/js/`. `npm run preview` serves it locally on port 5173 when the dev server is stopped. No publication is performed.
