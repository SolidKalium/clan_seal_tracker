# Browser edition

Vue + TypeScript + Vite, with browser-managed Bungie requests and a Dexie/IndexedDB cache. The legacy PHP edition is in [`php/`](../php/README.md).

## Run

From the repository root:

```bash
npm --prefix js ci
npm --prefix js run dev
```

Open **https://localhost:5173/js/** when OAuth is configured (otherwise **http://localhost:5173/js/**) through the dev container's forwarded port 5173. The server binds to `0.0.0.0` and requires port 5173 rather than silently selecting a different origin. If VS Code accepts connections but never forwards them, reload the VS Code window.

Copy `js/settings.example.json` to the ignored `js/settings.json` and fill in `secret_key` and `group_id`. It is independent of `php/settings.json`. `predev` and `prebuild` compile those values, optional public OAuth configuration, the default language, and the page catalog from `js/pages.jsonc` into ignored `.generated/*.json`. Restart dev after changing source settings/content. No PHP settings or caches are read. No JSONC parser is shipped to the browser.

**The Bungie API key is intentionally client-visible** in the dev app and built JavaScript. Keep `js/settings.json` limited to browser-safe values. Do not use this mechanism for OAuth client secrets or other confidential credentials. A production host must serve only `dist/` under `/js/`, not the repository or generated/source directories.

Bungie must allow the browser's exact origin in the application registration. For OAuth-enabled local use that is `https://localhost:5173`; HTTP and `127.0.0.1` are different origins. If using a different forwarded address, register that origin instead. Manifest downloads can succeed even while clan/profile endpoints reject the origin. The app displays the registration error and current origin. There is no development proxy masking this requirement.

## Page catalog

Edit `js/pages.jsonc` for the browser site's raid/activity list and display exceptions. It is independent of the PHP `php/pages.json`; the compiler no longer reads the old file. Pages are ordered by their position in this array, grouped as `Raid seals` (default) or `Activities`. Use `sealNodeHash`, `badgeNodeHash`, and `otherNodeHashes` for scope, with `records`/`collectibles` for extra full-raid content and supported display/scoring overrides. Element ordering (including Prismatic), day-one exclusions, numbered stages, item groups, and armor slots are derived from the manifest. Recompile with `npm --prefix js run prepare:data`, or restart dev after catalog edits.

Crota's End, Salvation's Edge, and The Desert Perpetual include all three page modes. The Desert Perpetual's Collective Psyche and Wayward Psyche armor sets have separate groups and set-completion tooltips; badge scoring still uses one whole class across the entire badge.

Activity pages use `#/seal/<id>` and `#/triumphs/<id>`. Crucible, Gambit, and Trials also have badge views. Their full triumph lists omit collection badge items, matching the legacy activity-page scope; pages without a badge still work. Gilding requirements retain the API label and legacy scoring (included in the percentage), with an explanatory footer note. Current manifest availability governs all pages; no archived-profile import is needed.

## Included

- Clan from `js/settings.json`, with a local overview and ten raids with Seal, Badge, and Full raid views, plus six activity seals with Seal/Triumphs views and optional collection badges. Raids and Activities have separate overview sections and navigation groups. The sidebar can collapse to an emblem and vertical clan name; its state persists locally. Cache status and refresh live in the top bar, with an explanatory status-color tooltip.
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

A failed fetch never changes the successful-fetch timestamp. Private responses retain any previously public data and mark it explicitly. Refresh rechecks the manifest and roster, applies the normal activity rules to public profiles, and explicitly retries private/failed profiles while honoring request throttling. A warm reload can display cached data without a Bungie request. Cache persistence is per origin/browser and may be evicted; the app shell is not yet a service-worker-backed offline app.

## Intentional limits

This slice implements **seal, badge, and full raid modes** for the ten configured raids, plus activity seal/triumph views for Crucible, Iron Banner, Gambit, Trials of Osiris, Strikes, and Weapons/Deadeye. Full raid percentages average the scored record and collection columns equally, including the badge requirement record and its individual items, following the legacy full-page weighting. Progress uses the PHP record-average calculation. Multi-objective triumphs have aligned objective subcolumns, with visible counts for partial objectives; a completed triumph collapses to one checkmark spanning its stages. Hover or keyboard focus opens a styled tooltip, and clicking pins the details below the table. Character records choose the best complete character record by aggregate progress, rather than combining objectives across characters. That is a deliberate clarification of the legacy heuristic. API character storage scope alone does not imply character-specific earning rules, so no blanket per-character label is shown. Title counts respect the completion record's own scope and recognize redemption on any character.

No per-user overrides, frozen profiles, hidden-player rules, historical-data import/UI, or server rendering. Archived datasets stay untouched.

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

`npm run lint` runs ESLint. `npm run format` applies Prettier, and `npm run format:check` reports files that need it.

### Tests and manifest audits

Application tests (`npm --prefix js test`) check behavior, including regression tests for the audit detectors using small synthetic definitions. Manifest audits run separately: an audit failure means content or curation needs review, rather than necessarily indicating an application bug.

The catalog audit builds the actual seal, badge, full-raid/dungeon, and triumph views and verifies that every record reachable through the current/legacy **Triumphs**, weapon patterns/catalysts, Guardian Ranks, and active/legacy seal trees is represented. Every badge under the Badges root and every named seal under the active/legacy title roots must also have a usable curated view. A configured node whose view fails to build does not count. Failures report missing hashes, names, and tree paths, or the unavailable page/mode.

Lore books and the current Medals branch are siblings of Triumphs, not part of this assertion. Orphan/internal definitions outside these trees and unnamed/redacted titles are also outside its scope. Historical pages explicitly marked `unavailableReason` do not count toward coverage of records that remain in the manifest. There is no missing-record allowlist.

| Command | Purpose | Network / fixture changes |
| --- | --- | --- |
| `npm --prefix js test` | Application behavior and audit-detector regressions | None |
| `npm --prefix js run audit` | Catalog coverage and unknown-token checks against the pinned manifest | None |
| `npm --prefix js run audit:live` | The same audits against current English Bungie definitions | Downloads public definitions; never updates the fixture |
| `npm --prefix js run audit:update` | Explicitly replace the pinned manifest baseline | Downloads and writes the fixture; review the diff and run `audit` afterward |

Audits use Vitest with `vitest.audit.config.ts` and live in `tests/audits/*.audit.ts`. They do not run as part of `test`. Run both `test` and `audit` when changing curated pages or symbol handling. These commands replace the older `test:coverage`, `test:coverage:live`, and `update:coverage` names, which could be confused with code coverage.

The compressed `tests/fixtures/catalog-manifest.json.gz` contains static definition fields needed to build and audit the views. It is independent of PHP's cache, contains no API key or player data, and is not loaded by the site. Neither tests nor audits silently approve exceptions or refresh the baseline.

Live token auditing collects bracketed tokens and their definition paths **before compaction**, including descriptions that the small coverage fixture otherwise discards. Item and perk token text are excluded for now; inventory item definitions are still downloaded for catalog coverage. Explicit fixture updates retain these token samples for offline audits. The existing pinned fixture is unchanged and predates these samples, so its offline token audit covers only the text already retained in it.

### Request error diagnostics

Failed Bungie requests log a `[Clan Seal Tracker] Request failed` warning and save structured diagnostics in the browser's `clan-seal-tracker-v1` IndexedDB database, `entries` store. Cached failures also have an `errorInfo` field alongside the existing `error` string. HTTP status, content type, request URL, attempt/timing, retry headers, and available Bungie error code/status/message are retained. Unreadable/non-JSON failures include a response excerpt capped at 2,048 characters. API keys and request headers are not logged; successful profile payloads and JSON error envelopes' `Response` data are not retained in diagnostics.

The latest 50 failures are saved as `diagnostic:…` entries, including failures without an older cached profile and failed attempts that later succeed. That bounded history survives retries and page reloads; a successful request clears the current cached `errorInfo`, while Clear API cache removes the diagnostic history as well. Storage-unavailable sessions retain only an in-memory history. No diagnostics are sent to a server. Logging does not depend on DevTools being open, but browser console retention is separate from this persistent history.

## Inline Destiny symbols

Record descriptions, perk descriptions, and objective tooltips replace recognized bracketed icon tokens with the bundled Destiny Symbols font. Icons have accessible text labels; unknown tokens and known literal bracketed names remain readable text. Champion tokens use the Anti-Barrier (`Shield-Piercing`), Overload (`Disruption`), and Unstoppable (`Stagger`) glyphs. `[Finisher]` remains plain text. The `Back` input prompt reads `Mission summary`, without assuming a visitor's key binding. Font provenance is in `src/assets/README.md`.

The separate manifest audit reports unknown bracketed tokens and their definition fields (see the audit commands above). Known literal text (for example `[REDACTED]`) has an explicit allowlist in `src/inlineSymbols.ts`. Neither the normal tests nor the offline audit fetches or updates the fixture.

## Hidden members view

Open `/js/#/members` (or `/js/members`) for the PHP-style clan members table. It is intentionally absent from the sidebar and overview. The view includes linked platform names, primary save and last platform, clan rank/join date/activity, profile freshness, guardian Power by class, and reported expansion and season/episode ownership. Search and sorting apply to both the table and CSV export; longest clan tenure is the default order.

It reuses cached roster/profile data. Linked memberships and the additional season definitions are requested only when this view is opened and cached for 24 hours. Unknown ownership remains distinct from unowned; stale/private profiles can retain previous public values.

The members Guardians cells show the highest reported `light` (Power) for each class; CSV retains every character's value. Its shared tooltip shows the actual characters and their last-played dates; no character-count assumption is made. Profiles now request Characters component 200, so a cache without that component is refreshed once under the component-coverage rule.

## Seal overview

Other → Seal overview (`#/triumphs/seal_overview`) shows the current clan's members as rows and seals as columns. Active seals and Legacy seals tabs are built from Bungie's title trees, without requiring a separate curated entry for each seal. Cells use each seal's completion record; gilding appears in details and does not affect completion. The Monument of Triumph's gilding remains a yes/no status.

## Clan search and selection

Choose clan in the sidebar opens public Bungie clan search. Search by name, clan ID, or Bungie clan URL; results support pagination. The selected clan and up to seven deduplicated recent clans are stored in this browser's visitor preferences. Suggestions identify the selected clan, previously viewed clans, and the configured default without duplicating entries. Changing clans preserves the current page; guardian filters reset for the new roster.

Roster caches and last-profile-pass summaries are scoped by clan. Profiles and definitions remain reusable across clans. A late response from an earlier clan cannot overwrite the selected clan's rows or status. Clear API cache preserves the selected clan and recents.

Login automatically selects your own clan and prioritizes it over recents. Friend-based clan suggestions are available after login; the sidebar also supports friend and combined player lists. Public browsing does not imply clan membership.

## Focus styling

`src/focus.css` owns focus indicators for links, buttons, native fields, and focusable table elements. Standalone controls use an inset outline. Composite fields mark their visible wrapper with `control-field`; that wrapper owns one inset ring and suppresses the inner field's duplicate indicator. Keep focus rules here rather than adding control-specific overrides. Selection backgrounds and row highlighting remain presentation rules in `style.css`.

## Player login

Sign in with Bungie in the sidebar uses the Public OAuth authorization-code flow. Login selects the signed-in player's primary-save clan; subsequent browsing can still select any clan. Your clan stays first in clan suggestions.

Configure the same Bungie application's API key and `oauth_client_id` in the ignored `js/settings.json`. Set `oauth_redirect_uri` to the exact registered redirect, locally `https://localhost:5173/js/`. Register the browser origin as `https://localhost:5173` (without a path). Enable **ReadBasicUserProfile**, **ReadDestinyInventoryAndVault**, and **ReadUserData** (for friends); despite that permission's inventory-oriented name, Bungie uses it for private Destiny 2 progression too. No inventory components are requested. Do not configure a client secret. See [Bungie's OAuth documentation](https://github.com/Bungie-net/api/wiki/OAuth-Documentation).

An HTTPS redirect automatically enables Vite's basic SSL plugin for development and preview. Plain HTTP on the same port redirects to the configured HTTPS origin, preserving the path, query and browser fragment. Accept its self-signed local certificate once; in VS Code's Ports panel choose HTTPS for port 5173 if its generated link still uses HTTP. HTTP and HTTPS have separate browser storage, so switching to HTTPS starts a fresh cache and visitor preferences. Production should use its host's trusted HTTPS certificate.

The random, one-use OAuth state expires after ten minutes. Callback parameters are removed from browser history before the exchange. The access token is held in this tab's session storage; private profiles are held only in memory and never written to public IndexedDB entries. Reloading a signed-in tab verifies the account and refetches its private profile. Closing the tab ends its session. Public clients receive no refresh token, so access-token expiry requires signing in again.

Bearer requests are restricted to account verification, the signed-in user’s Bungie friend list, and profile IDs returned by Bungie for the signed-in user. Cross-save is resolved within those verified memberships. Clanmates and friends remain unauthenticated public requests: being in the same clan does not grant extra access. Signing out or session expiry immediately removes private rows/tooltips and clears the private memory cache; late requests cannot put those values back. Authenticated error bodies and token responses are excluded from persistent diagnostics and console logging. A CSV explicitly exported while signed in can include the user's own visible private values.

### Friends’ clan suggestions

After login, load the accepted Bungie friend list (`/Social/Friends/`, requiring `ReadUserData`) in the background. Find each friend’s clans through public `GroupV2/User` requests, using their last-seen Destiny membership or Bungie membership as a fallback. No friend profiles or inventories are requested. Relationships and resulting suggestions stay in memory and clear on logout/expiry. Friends’ names are not saved in clan preferences.

The chooser keeps your clan first, with no friend/recent labels for it. Other suggestions show three entries: up to three friends’ names, or two names and a remaining count when there are more than three friends. Group clans by friend count, then online count and clan name. Deduplicate suggestions across selected, friend, recent, and default clans. Read the friend list at most once per five minutes, and reuse public membership-to-clan lookups for fifteen minutes within the login session. At most three lookups run concurrently; partial failures retain other suggestions and offer a retry.

The [Bungie friend schema](https://github.com/Bungie-net/api/blob/master/openapi.json) exposes online/offline-or-unknown presence and the last membership used, **not a last-active timestamp**. Presence is not a claim that someone is currently playing Destiny 2; `onlineTitle` separately identifies the game when available. No timestamps are inferred from these fields. Platform-native friend lists and pending requests remain separate work.

Clan rows retain the roster membership identity even when cross-save supplies another platform’s progress. If those platforms differ, append the joined platform to the guardian name and explain the primary-save source in the guardian tooltip. Also label the joined platform when cross-save is off and public linked-membership data confirms multiple platforms; each row keeps its own save’s progress. Resolve those memberships in the background using the existing 24-hour public cache, with at most three concurrent lookups. Collapse memberships only when Bungie identifies the same account and the same nonzero cross-save override. Prefer the primary-save roster membership, list the additional memberships and their overridden-save status in its guardian tooltip, and count the account once for title/badge ownership. The Members view and CSV follow the same row grouping. Distinct non-overridden saves stay separate.

“Primary save” labels and emphasis require a nonzero crossSaveOverride. A membership platform alone does not designate an account-wide primary save.

## Player-list selector

The sidebar’s Players selector supports **Selected clan**, **My friends**, and **My clan and friends**. The last two require login. Selected clan always refers to the visitor’s saved clan choice; the combined list uses the signed-in player’s own clan even when a different clan is selected for browsing. Choosing a clan returns to Selected clan. The selected list mode is a browser preference; signing out or expiry immediately returns to public clan browsing and clears the social list from memory.

Accepted Bungie friends resolve through public, cached linked-membership lookups to their cross-save primary or last-used independent platform. Profile requests retain the existing self-only authentication rule. A friend already represented by the clan’s same save appears once with clan metadata preserved. Friends without a public Destiny membership remain visible as unavailable, without issuing invalid profile requests. Friend-only account tooltips omit clan ranks/join dates.

Friend list retrieval is separate from clan suggestions, so profiles do not wait for every friend’s clan lookup. Fetch memberships and profiles with bounded concurrency. Online status only counts as known Destiny activity when presence identifies Destiny 2; there is no inferred last-active timestamp. Unknown-activity profiles use the existing five-minute cache rule. Sync summaries are scoped by list and signed-in account; friend relationships and assembled lists are never written into the public roster cache.
