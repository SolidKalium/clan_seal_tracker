# JavaScript migration decisions

Created: 2026-10-29. Updated: 2026-10-30. Status: decisions in progress; accepted choices are marked below. Other recommendations remain proposals.

Review checkpoint: the user has reviewed through the decision table. Later sections remain discussion material, not an approved MVP.

## Direction and constraints

- Explore replacing PHP rendering and data processing with a browser application.
- Keep application-controlled freshness and invalidation; HTTP cache headers alone cannot express player activity, component coverage, or manifest dependencies.
- Keep the PHP version usable for comparison until the replacement is useful.
- Select an MVP rather than promising parity with every page and exception.
- Consider dropping individual progress overrides; no feature removals are final yet.
- Reorganize settings and content as their responsibilities become clearer.
- Local development servers must bind to `0.0.0.0` in this dev container.

## Current implementation findings

- `index.php` combines routing, headings, progress calculation, sorting, and HTML output.
- `library/bungie_api.php` handles API requests; `library/groups.php`, `library/profiles.php`, and `library/definitions.php` own file caching.
- Definitions check freshness on a five-minute interval and compare manifest component filenames. Rosters default to three minutes. Profiles use activity timestamps, a five-minute window for recently active players, and a default seven-day maximum age.
- Profiles may retain older cached public data when a new response is private. The new UI should make this distinction visible.
- `settings.example.json` mixes API configuration, a clan ID, skipped updates, hidden players, and progress overrides. `pages.json` combines content grouping with rendering and calculation instructions.
- Both files use comments/trailing commas accepted by a custom PHP loader, not strict JSON. Convert deliberately or use a real JSONC parser; do not copy the comment-stripping regex into JS.
- One archived definition directory and one archived profile directory each occupy about 69 MB on disk. Browser memory and cold-load cost need measurement; these are not estimates of current network transfer size.
- Historical caches are ignored by Git. Do not automatically bundle or publish them with the new app.

## Decision register

Status is recorded in each starting-point cell. Acceptance of a technology does not imply approval of all implementation details or the proposed MVP.

| ID | Choice | Options | Status / starting point | Reason / reconsider when |
| --- | --- | --- | --- | --- |
| D01 | UI framework | Vue, React, plain JS | Accepted: Vue; proposed: Composition API | HTML templates suit the table-focused app. React is equally viable if JSX/hooks or existing React experience is preferred. Keep domain logic independent of either. |
| D02 | Language and build | JS or TypeScript; Vite or larger framework | Accepted: TypeScript + Vite | Types help with Bungie payloads, page definitions, and progress variants. Server rendering is very low priority. |
| D03 | API architecture | Direct browser requests; small JS proxy; shared caching backend | Accepted: direct browser requests initially; proxy later if useful | User reports the key working on localhost. Keep transport replaceable; validate remaining endpoints and production origins during implementation, without blocking the initial architecture choice. |
| D04 | Persistent storage | IndexedDB, SQLite WASM/OPFS, memory only | Accepted: IndexedDB through Dexie | Keyed records suit the initial app. Landing-page summaries can be derived or cached without requiring SQL. SQLite is deferred unless a concrete need emerges. |
| D05 | Working data | Load everything into objects; load selected records | Small maps for active data, persistent store for the rest | Avoid making every profile and definition part of reactive UI state. Memory-only mode should remain usable if persistence fails. |
| D06 | Cache policy | Generic request cache; domain policy | Explicit cache service | Store freshness metadata and validate payloads before replacement. A query library can manage loading state without owning domain freshness. |
| D07 | Parallel versions | Move PHP now; keep PHP root and add `/js/`; `/old/` and `/new/` | Accepted: keep PHP in place, add `/js/` initially | Avoid breaking relative paths and existing caches during the first slice. Later move legacy code to `/php/` in a dedicated change if desired. |
| D08 | New app URLs | Hash routing; history routing | Hash routing initially | Works under `/js/` without server rewrite rules. Preserve content IDs and provide legacy-link mapping at cutover. |
| D09 | Configuration | One JSON file; files split by purpose; editable settings UI | Accepted: compile JSONC to strict JSON; visitor-owned settings in local storage | Clan choices and users of interest belong in the visitor data store. Repository files may offer defaults. Exact schemas and settings UI remain open. |
| D10 | Content buckets | Existing categories; era/activity taxonomy; tags | Open: stable IDs + category, subcategory, lifecycle, tags | Navigation can change without renaming content IDs. Historical data supports archaeology and future tests; historical UI is low priority. |
| D11 | Legacy exceptions | Port all; remove all; explicit opt-ins | Defer progress overrides, forced frozen profiles, per-page hidden users | First establish faithful progress computation and visible stale/private states. Revisit exceptions individually. |
| D12 | Offline behavior | Online only; cached data fallback; installable PWA | Cached data fallback | Support API outages after a successful visit; full offline app startup and service worker updates are separate later work. |
| D13 | User scope | One configured clan; clan picker; multiple clans | Accepted: use `settings.json` clan initially; selector after most current features are ported | Preserve the longer-term direction of visitor-owned clan choices and users of interest. Do not bundle the entire settings file into the browser app. |
| D14 | Browser support | Chromium only; Safari + Chromium; wider matrix | Current Safari + Chromium | Safari is used here. Storage and CORS validation must include it before selecting SQLite or promising browser-only deployment. |

## Vue versus React

Decision: Vue accepted on 2026-10-30. Comparison retained for rationale. Composition API remains a recommendation.

Both can render this app and use the same storage, workers, and API services. Neither choice resolves caching.

| Concern | Vue | React |
| --- | --- | --- |
| UI authoring | HTML-oriented templates and single-file components | Components written as JS/TS functions, commonly with JSX |
| Interactive state | Reactive refs/computed values | State and hooks; derived values during rendering |
| Fit here | My preference for a small, table-oriented app | Prefer if the maintainer wants React experience or its component ecosystem |
| Shared architecture | Pure TS calculations and repository interfaces | The same pure TS calculations and repository interfaces |

Use a semantic HTML table initially. Add a table library or virtualization only if actual row/column counts or interaction requirements justify it.

## IndexedDB versus SQLite versus objects

Decision: IndexedDB accepted as the starting direction on 2026-10-30. Dexie is accepted as the IndexedDB wrapper.

| Storage | Strength | Cost | Suggested role |
| --- | --- | --- | --- |
| In-memory maps/objects | Simple, fast access to current data | Lost on reload; loading the full dataset raises memory use | Active definitions, current rows, in-flight request deduplication |
| IndexedDB + Dexie | Persistent keyed objects, indexes, transactions, versioned upgrades | Queries and joins are application code | Default browser cache candidate |
| SQLite WASM + OPFS | SQL joins, indexes, aggregation, explicit schema | WASM download, worker communication, browser persistence and tab coordination | Alternative if SQL is a goal or measurements favor it |
| localStorage | Simple small preferences | Synchronous, string-based, limited capacity | Small non-sensitive preferences at most |

SQLite is viable, but do not choose a persistence mode blindly. SQLite's `opfs-sahpool` avoids the COOP/COEP requirement of its regular `opfs` mode, with different concurrency tradeoffs. Test two tabs, Safari, reload persistence, and third-party assets before adopting a mode.

Browser caches are per origin and browser profile, may be evicted, and are not shared across visitors. Each visitor initially fetches their own data. Request persistent storage where appropriate, handle quota failures, and make all cache contents rebuildable. Keep the development origin stable; changing its port creates a different storage origin.

## Proposed data and cache design

Separate responsibilities:

```text
UI -> progress/selectors -> repositories -> cache policy -> Bungie transport
                               |
                       IndexedDB or SQLite
```

Persist these logical entities (physical tables/object stores can change):

- Manifest metadata and definition records keyed by manifest version, language, definition type, and hash.
- Clan rosters keyed by clan ID, with successful-fetch timestamps.
- Profiles keyed by membership type and membership ID, with fetched component coverage and timestamps. Keep membership IDs as strings to avoid JS integer precision loss.
- Membership resolution cached separately from large profile payloads.
- Visitor-owned preferences: selected/followed clans, users of interest, filters, and display settings, with schema versions and defaults. Keep credentials out of content definitions.
- Optional derived landing-page summaries keyed by clan, page, definition/content version, calculation version, and the input profile revisions used.

Per cached response track `fetchedAt`, `lastAttemptAt`, source/version, relevant component coverage, and any error/private state. A fetch attempt must not make old data appear freshly fetched.

Proposed rules, to confirm with usage:

1. Show usable cached rows immediately, with freshness and loading status.
2. Deduplicate requests and use bounded concurrency; honor API throttle/retry signals and back off after failures. Manual refresh still obeys throttling.
3. Start with the existing roster/profile timing rules, separated into testable policy functions. Required components missing from cache force a fetch regardless of age.
4. Build a new manifest version separately, validate required definitions, then switch the active version atomically. Retain the previous complete version until success; clean up later.
5. Do not replace a known-good public profile with an error or an empty/private response. Show that retained data is older and the current profile is private/unavailable; do not imply current public access.
6. Provide refresh-current-view and clear-cache actions, plus per-player errors. Cancelling navigation should not leave an unfinished cache write marked complete.
7. Cache raw responses and derive table cells on demand initially. Version any persisted derived data so logic changes invalidate it.
8. Keep account-level and character-level records distinct. Preserve objective completion, gilding, and missing/private distinctions for whichever page types the MVP supports.

### Future landing-page summaries

Desired feature: show clan statistics beside page links. Start with the same pure calculation functions used by progress tables. Compute summaries from already cached inputs on demand, and optionally persist small aggregate records if measuring shows this improves landing-page load time. IndexedDB can store these records; SQL is not required.

Invalidate summaries when roster membership, relevant profile data, definitions, or calculation/content rules change. Track coverage (for example, 35 of 40 profiles available), input freshness, and pending/error states so incomplete data is not shown as a complete clan total. Do not fetch every large profile solely to paint navigation; show available summaries and update progressively. Exact statistics and MVP inclusion remain open.

HTTP caching may still help immutable assets and versioned definition downloads. It supplements these rules rather than defining when profile data is useful.

## API access and settings boundaries

Decision: use direct browser API access first; consider a server proxy later. The user reports that the key works on localhost. During implementation, check remaining API/manifest endpoints and the intended production origin. Bungie's documentation requires browser API origins to match the application registration. A Vite development proxy passing a test does not prove production browser access works.

Anything sent to a browser, including a build-time environment variable compiled into JS, is readable by its user. The browser-first direction accepts client-visible API access; the exact key provisioning mechanism remains to be specified. Keep it separate from visitor preferences and content so a later proxy can replace the transport. OAuth client secrets and confidential credentials must remain server-side. OAuth/private data is outside the proposed MVP.

Proposed configuration buckets:

- **Deployment:** API transport mode, browser client configuration, suggested default clan and language. Defaults seed visitor choices rather than overriding them. Server secrets live separately if a proxy is chosen.
- **Content:** Stable page IDs, labels, category/subcategory, lifecycle (`active`, `legacy`, `archived`), tags, data requirements, and explicit calculation rules.
- **Visitor data:** Selected/followed clans, users of interest, selected page, filters, sort order, display choices; stored in the visitor database with schema versions and optional repository defaults. Distinguish these intentional choices from disposable API caches; clear-cache should preserve them.
- **Cache policy:** Versioned application defaults for freshness/concurrency. Only expose controls users actually need.
- **Legacy exceptions:** Separate optional migration input; never silently import progress overrides into authoritative API data.

Use explicit schema validation and clear error messages. Compile JSONC source files to validated strict JSON during the build; browsers should receive strict JSON and should not need a JSONC parser. Only intentionally public configuration belongs in this output. Validate references and hashes without assuming historical content remains in the current manifest.

Suggested source organization after D01–D09 are chosen:

```text
js/
  src/
    api/
    storage/
    domain/
    content/
    components/
    views/
  public/       # intentionally public assets only
  package.json
```

These are source paths, not a proposal to publish the entire repository. Do not copy `settings.json` or PHP cache directories into `public/`. Moving PHP later must account for includes, working directories, ignored cache paths, settings, and old URLs.

## Proposed MVP

### Technical proof before building out the UI

- Build on the reported localhost key success: verify a manifest, one clan roster, and one public profile through the new browser transport; record any deployment-origin registration work.
- Compare one representative progress table from the PHP app against browser-derived results using the same captured input.
- Persist/reload representative definitions and profiles in Safari and Chromium; measure download, parse time, memory, and table rendering. Prototype SQLite only if SQL is desired or IndexedDB results identify a concrete problem.

### First useful release

- Proposed initial slice: one selected clan and a small curated catalog, starting with one current seal page selected after checking available manifest content. Use the clan from `settings.json` initially. Defer the clan chooser until most current features are ported, while keeping future visitor-owned selection possible.
- Catalog navigation and a reusable progress table with sticky headings/player names, sorting, name search, and complete/incomplete filtering.
- Account-level record objectives and seal completion for that slice. Select fixtures that also expose character-scoped requirements before declaring the calculation reusable.
- Progressive loading, explicit stale/private/unavailable states, refresh and clear-cache controls.
- Persistent definitions/roster/profiles and application-controlled refresh policy.
- Reload with API unavailable still displays previously cached data if the app shell is reachable.
- Comparison tests for progress rules and cache decisions; Playwright checks for first load, warm reload, refresh failure, and navigation. Safari checks are required alongside Chromium.

### Deferred

- Full migration of every `pages.json` entry, historical manifest snapshots, and all legacy links.
- Badges/collectibles, checklists, commendations, crafting patterns, and other specialized page types until added as separate slices.
- Manual progress overrides, forced profile freezing, and per-page player exclusions.
- OAuth, private-data access, multi-clan management, cross-device preferences, and shared server caching.
- Content/settings editor, automatic discovery of all new content, PWA installation/full offline startup, and historical trend tracking.

### MVP acceptance

- A new visitor can open the configured clan's supported seal page and understand loading/errors without waiting for the entire clan to finish downloading.
- Warm reload uses valid stored data; stale refresh updates rows without erasing usable data on errors.
- Supported calculations match the agreed fixtures; intentional differences from PHP are documented.
- Manifest replacement cannot expose a partially installed definition set.
- Chrome and Safari work under the intended deployment path, with documented recovery when persistence is unavailable.
- No credentials or historical profile caches are unintentionally published.

## Next decisions

Accepted foundation: Vue, TypeScript, Vite, direct browser API access, IndexedDB, build-time JSONC compilation, and visitor-owned choices. Also accepted: Dexie, `/js/` alongside existing PHP, and the clan from `settings.json` initially. Clan selection follows the port of most current features. Still open: framework API style, exact key provisioning, routing, precise content taxonomy, and detailed MVP scope (including landing-page summaries). The user is still reviewing the document; do not treat the later MVP proposal as accepted.

Braytech, DIM, D2 Checklist, and Destiny Data Explorer are research references suggested by the user. Their division of browser/server processing has not been investigated here; do not assume they use any particular data architecture.

Preserve historical local data for archaeology and testing possible future historical features. Building those features is low priority; preserving archives does not require publishing or loading them in the initial browser app.

## Decision history

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-29 | Explore a browser-based replacement while selecting scope and storage | User direction |
| 2026-10-29 | Initial architecture and MVP proposals | Discussion draft |
| 2026-10-30 | Vue, TypeScript + Vite; server rendering low priority | Accepted |
| 2026-10-30 | Direct browser API access first; possible proxy later | Accepted; user reports localhost key works |
| 2026-10-30 | IndexedDB as initial persistent store | Accepted direction; wrapper open |
| 2026-10-30 | Compile JSONC to strict JSON before browser delivery | Accepted |
| 2026-10-30 | Visitor-owned clans/users of interest/settings; repository defaults optional | Accepted direction |
| 2026-10-30 | Clan selection and landing-page stat summaries | Desired; MVP inclusion open |
| 2026-10-30 | Historical data retained for archaeology/tests; historical UI low priority | User direction |
| 2026-10-30 | `/js/` alongside PHP, Dexie, initial clan from `settings.json` | Accepted |
| 2026-10-30 | Clan selector after most current features are ported | Accepted sequencing |
| 2026-10-30 | Routing and detailed MVP | Still proposed |

## Sources checked

- [Vue introduction](https://vuejs.org/guide/introduction) and [Vue quick start](https://vuejs.org/guide/quick-start)
- [React quick start](https://react.dev/learn)
- [Dexie](https://dexie.org/)
- [SQLite WASM persistence options](https://sqlite.org/wasm/doc/tip/persistence.md)
- [Bungie browser origin requirements](https://github.com/Bungie-net/api/wiki/Cross-Origin-Resource-Sharing-(Origin-header))
- [Browser storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## Suggested implementation defaults for the first slice

No additional product decisions need block a first slice. Unless revised, use Vue Composition API, hash URLs, and a semantic table; port one existing seal page end to end before expanding the catalog. Select the page after checking that its hashes are available in the active manifest. Keep calculations separate from Vue and use the same captured API inputs when comparing with PHP.

Read only the required clan/API configuration from the ignored local `settings.json` for development, through a deliberate allowlist; never serve or copy the whole file. Browser-delivered API credentials are client-visible. Production provisioning can be specified before deployment, and server-only credentials must remain excluded.

First-slice completion: navigation to the supported page, clan roster and profile loading, progress rendering/sorting/filtering, persistent cache reuse, refresh, and clear loading/stale/private/error states. Detailed edge-case semantics should be checked against PHP and documented where intentionally changed. Later feature ports and the final MVP acceptance list remain reviewable as implementation exposes them.

## MVP implementation status — 2026-10-30

Implemented locally in `/js/` using Vue Composition API, TypeScript, Vite, Dexie, and hash routes. The first slice shares one seal engine across the seven existing raid-seal entries. It implements seal mode only; badges, collectibles, and additional records from the broader PHP pages remain deferred.

Included: clan overview, known-title counts with loaded-profile coverage, progressive profile loading, search/filter/sort, sticky progress table, objective details, refresh/retry, persistent cache, preferences, stale/private/error states, memory fallback, and cache clearing that preserves preferences. JSONC is compiled at dev/build time through an explicit allowlist. No proxy, historical import, or clan selector was introduced.

Calculation clarification: character-scoped requirements choose the single character record with the best aggregate progress. This intentionally replaces the legacy per-objective character-selection heuristic and never merges objectives across characters. Missing records remain distinguishable from incomplete records; no user overrides are imported.

Verification: 16 unit tests and five Chromium Playwright scenarios pass. Shared synthetic inputs match the PHP progress function. A captured current public profile provided another 134 matching record calculations across all seven seals, whose required manifest definitions were all present. Desktop and mobile screenshots were inspected. Safari has not been manually verified.

Live API finding: manifest and definition downloads work from the browser, but clan requests initially returned `OriginHeaderDoesNotMatchKey`. The user registered `http://localhost:5173`; Bungie reports propagation can take up to 20 minutes. This registration is independent of successful server-side API calls. The UI explains the error and supports retry after propagation.

See `js/README.md` for run/build commands, data boundaries, tests, and remaining scope.

## First feedback pass — 2026-10-30

- Fixed title counts for character-scoped completion records (DSC). Read the scope from the manifest and check all relevant character records, including ties in objective progress. Live validation showed 14 title holders among 27 loaded profiles.
- API storage scope is not a reliable label for how a triumph is earned. Removed the blanket “Per character” label. Most triumph records may be replicated across characters; future badge/collection pages need their own completion semantics and must not combine incompatible character progress.
- Restored visible stages: multi-objective triumphs use aligned objective subcolumns, showing counts for partial objectives and one spanning checkmark for a completed triumph.
- Replaced repetitive native tooltips with styled titles/descriptions, named objectives, distinct counts, and subdued completion text. The same structured content appears in pinned details.
- Connected the search focus ring to its visible container and matched the dropdown heights.
- Future navigation idea: turn the activity / page-type breadcrumb (e.g. “Deep Stone Crypt / Seal requirements”) into discoverable dropdowns once more page types are available. Deferred, not implemented in this pass.
- Origin registration is now working: the live browser loaded all 27 profiles without API notices or runtime errors. Build, 18 unit checks, and six Playwright scenarios passed; desktop/mobile layouts inspected.

Stage display correction: use compact numbered stage headers (1, 2, …), not objective names in the table. Keep numbered objective names in hover/focus and pinned details so the table remains dense and scannable.

## Table interaction refinements — 2026-10-30

- End-of-triumph dividers now extend through numbered subheaders, including boundaries adjacent to single-stage/row-spanning headers.
- Hover/focus tooltips are pointer-transparent and dismiss immediately when leaving their trigger; they cannot trap the pointer over covered cells. Clicking record cells still provides pinned, selectable details.
- Guardian rows are compact (approximately 35 px); names open details with freshness, fetch time, errors, and linked platform display names. Linked memberships are requested on demand, deduplicated, and cached for 24 hours with stale fallback.
- The table scroll container uses the site background and contains overscroll, with a matching scrollbar track. Native Safari rubber-band rendering remains a manual visual check.
- Build and browser checks cover group boundaries, row height, guardian details, pointer hit testing through tooltips, and the scroll background.

Overscroll border correction: attach the rounded outer border to the table itself, not the stationary scroll container, so rubber-band scrolling moves the table and its border together. Keep the exposed scroll background matched to the site.

## Revisit list

Recorded 2026-10-30. Deferred polish and interaction design; these are not requests for immediate implementation.

- [ ] Revisit table overscroll appearance, especially Safari's rubber-band effect. Moving the border onto the table substantially improved it; the current result is acceptable for now.
- [ ] Shrink tooltips and review their information density. Keep them useful for quick inspection without obscuring large portions of the table.
- [ ] Remove or redesign click-on-cell behavior. The current pinned detail panel is provisional. Possible actions include navigating to a player page or opening a modal with richer triumph/collectible details, such as relevant YouTube guides. Exact action, context, and content sources remain undecided.
- [ ] Revisit activity / page-type breadcrumb dropdowns when more page types are added.

## Clan tenure and ranks — 2026-10-30

Added persistent “Clan tenure · longest first” sorting using the roster's `joinDate`. This order is independent of profile visibility and completion; missing/invalid dates sort last, with guardian name breaking ties. Guardian tooltips now include the clan role and join date, using roster data already cached by the app.

Rank labels follow Bungie's `GroupsV2.RuntimeGroupMemberType`: None (0), Beginner (1), Member (2), Admin (3), Acting Founder (4), Founder (5). Missing/unknown values are explicit. Source: https://bungie-net.github.io/multi/schema_GroupsV2-RuntimeGroupMemberType.html
