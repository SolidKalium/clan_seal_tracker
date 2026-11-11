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

## Clan tenure and ranks — 2026-10-30

Added persistent “Clan tenure · longest first” sorting using the roster's `joinDate`. This order is independent of profile visibility and completion; missing/invalid dates sort last, with guardian name breaking ties. Guardian tooltips now include the clan role and join date, using roster data already cached by the app.

Rank labels follow Bungie's `GroupsV2.RuntimeGroupMemberType`: None (0), Beginner (1), Member (2), Admin (3), Acting Founder (4), Founder (5). Missing/unknown values are explicit. Source: https://bungie-net.github.io/multi/schema_GroupsV2-RuntimeGroupMemberType.html

## Menu compactness pass — 2026-10-30

Moved cache/progress status and refresh into the top bar, replacing “Browser Edition”; removed the generic “Clan / Raid seals” utility row. Errors remain above page content. The status indicator explains its colors on hover/focus: green ready, amber updating/stale/private/memory-only, red loading failures. Removed “known” from title-holder labels.

Added a persistent sidebar collapse toggle. The collapsed rail retains its emblem and a vertical clan name; remaining navigation and metadata are hidden until expanded. Desktop and mobile layouts were visually checked, including expansion after reload. The broader user-authored revisit items remain open; this addresses the selected menu/status changes only.

## Status and collapsed-rail refinements — 2026-10-30

Use “Records synced” when settled and “Syncing records” while refreshing. The detail line holds transient phases and profile counts. A fixed-width status area and refresh button keep the pip horizontally anchored; it aligns with the top line during refresh and returns to vertical center when settled. Its tooltip uses the same styled, pointer-transparent surface as record tooltips, listing the meanings and bolding the current state without a redundant current-state heading.

Reduced the error-free gap above the page breadcrumb while retaining error notices and their spacing. Enlarged collapsed clan names, with short names using about 60% of the rail width; keep them selectable with a normal arrow cursor.

## Page edges and right-aligned sync status — 2026-10-30

The root canvas uses the header color above the measured header boundary and the site color below it, including exposed side regions during page overscroll. Header height is observed so this follows mobile wrapping. A full-height sidebar backdrop and divider now reach the footer while the actual menu remains sticky.

Settled sync text sizes to its content beside Refresh. During refresh the pip sits directly beside the short primary line; longer detail text is right-aligned below it and may extend farther left than the pip. This replaces the fixed-width status area. Collapsed clan-name sizing remains unchanged (36 px for short desktop names).

## Refresh counter and overscroll follow-up — 2026-10-30

The profile refresh counter previously counted cached rows as already checked, so a refresh could sit at 27/27 while requests were still running. Track completed work in the current pass separately. Use “Checking profiles… · N / total done” during the pass and “N / total profiles” afterward; omit the counter while definitions/roster are being checked.

User testing found Safari colored horizontal top overscroll correctly but reversed the vertical gradient at the page bottom; Chrome did neither. Repeating root backgrounds can cause this behavior (https://bugs.webkit.org/show_bug.cgi?id=247231). Replaced the root gradient with solid, matching html/body/theme colors that follow the current document edge. Actual app surfaces retain the site background. Passive scroll/wheel listeners only choose the color; they do not prevent default scrolling or simulate rubber-band movement. Recheck native Safari/Chrome visually before considering overscroll finished.

Build and 12 Chromium browser scenarios passed, including a refresh held at 0/N while cached rows remain visible, completion wording, and top/bottom canvas color selection.

## Side overscroll paint extension — 2026-10-30

User confirmed solid edge colors fixed top/bottom in Safari and Chrome, but side overscroll still samples a single color instead of following the visible header band. Tested large header padding plus equal negative margins: content stayed positioned, but document scroll width doubled. Use paint-only spread shadows clipped to horizontal bands instead: header color extends sideways within the header's height; site color extends beside the content below it. This does not add horizontal scroll range. Keep the solid edge-color fallback for top/bottom. Native browser rubber-band compositing still needs user confirmation.

## Overscroll stabilization rollback — 2026-10-30

User reported no improvement at the right edge and jitter around combined top/side overscroll. Removed the large spread shadows and clip paths. Reduced canvas/theme color changes to actual document edges; mixed-axis wheel gestures no longer reset edge colors. Wheel intent is used only for clearly vertical gestures when the page has no vertical scroll range. The side-band mismatch remains on the revisit list; native jitter improvement needs user confirmation.

## Native gesture baseline — 2026-10-30

Safari jitter persisted/worsened, and the user observed Chrome starting a back-swipe preview while the opposite overscroll was still visible. Removed all custom page-edge scroll/wheel color handling and runtime theme-color changes, along with the experimental paint layers already reverted. Use a stable site-colored html/body canvas and matching static theme-color. Header rendering remains dark within its normal bounds. Browser navigation gestures remain enabled.

Precise per-edge colors are deferred. This intentionally prioritizes a clean native-scrolling baseline over the prior top/header-color effect. Do not claim the native jitter is fixed based on headless tests; request user confirmation before further gesture workarounds.

User confirmation: jitter remains in both Safari and Chrome, but is less severe after removing the custom handling. Keep this baseline; the issue is unresolved. Further investigation should use native browser gestures and account for Chrome's back-swipe preview, sticky headers/sidebar, and nested table scrolling. These are investigation leads, not established causes.

Deferred at the user's request. The user confirmed that their Book Info Lookup project does not jitter under the same overscroll gestures in either browser. Use it as a comparison when investigation resumes; do not assume the remaining jitter is unavoidable browser behavior. No further scrolling changes in this pass.


## Badge and full raid views — 2026-10-30

Added `#/badge/<raid>` and `#/raid/<raid>` beside the existing seal route for all seven configured raids. Compact Seal / Badge / Full raid links switch view; sidebar raid links preserve the current mode. PHP and historical caches remain untouched.

- Badge scope comes from each collection presentation node. Shared collectibles occupy one column; parallel class armor sets occupy five compact slot columns. Default scoring selects one best whole class set per guardian, never mixing armor across classes. A class selector allows inspecting a specific class. Tooltips include class-specific item names and ownership. Missing/private collection data stays distinct from uncollected items. The parallel class-set shape was checked against all seven local manifest badges; incomplete class sets or missing required collectible definitions fail visibly instead of silently reducing the denominator.
- Full raid scope unions seal records, raid presentation-node records, and configured additional records/collectibles, then adds badge items. Records and collection hashes are deduplicated. Full raid mode includes raid achievements hidden by legacy suppress overrides (notably flawless and day-one records); seal suppression remains otherwise intact. Obsolete configured extra record hashes absent from the current manifest are ignored; missing required node records still make the view unavailable.
- Automate elemental labels/order from English manifest descriptions: Arc, Void, Solar, Stasis, Strand, followed by same-class requirements. Keep configured exceptions for unrelated records. Seal requirements come from the seal node, so newly added Strand triumphs outside the seal do not inflate seal completion.
- Detect first-24/48-hour and Contest Mode achievements from descriptions. Show them consistently in both triumph views, labelled Day one / Not scored, excluding them from percentages. Existing explicit skip-for-completion rules also apply, including collectible exceptions.
- Full-page completion averages scored record and collection columns equally, preserving the legacy full-page weighting (badge requirement record plus individual badge items). Badge completion itself uses the selected whole class set.
- Fetch profile component 800 with 100/900, and add collectible definitions to the atomic manifest cache. Existing caches upgrade automatically through component/table coverage checks, even for an unchanged manifest version. No extra requests are needed to switch views after sync.

Verification: domain tests cover normalized order and seal scope, unscored day-one achievements, missing collection data, and the mixed-class false-completion case. Repository tests cover upgrades from a fresh record-only manifest. Playwright covers view switching, cached navigation, collection percentages/private rows, and class selection. Live DSC badge and full raid data loaded for all 27 members; the full view had 48 headings, including Strand and unscored Day one, with no browser errors. Local current-manifest checks built all 21 views successfully. Final verification: 25 unit tests, 15 Chromium browser scenarios, and the production build passed.


## Armor tooltip comparison — 2026-10-30

Armor details now compare all classes in a compact table: piece collected and a quieter Set Complete row, with checks for true values and a dash for unknown data. Set Complete means all class-specific armor slots collected, independent of shared weapons/cosmetics and the selected scoring class. Removed the redundant selected-class progress summary. Class icons in the main table cells remain a future change.


## Collection groups and objective wording — 2026-10-30

Added a column header tier for Triumphs, Weapons, Weapon Patterns, Armor, Armor Mods, Cosmetics, and otherwise-unclassified Collection items. Grouping is derived from inventory item types and record types, with stable order inside groups. Existing numbered objective stages remain underneath, with sticky offsets accounting for the additional tier.

Collection tooltips use inventory item type names (for example Scout Rifle, Emblem, Ghost Shell), and armor mods list sandbox perk names/descriptions. Source text that only names the current raid is omitted; sources with extra instructions or other activities remain visible. Download/cache inventory-item-lite and sandbox-perk definitions alongside the atomic manifest snapshot; retain only the item fields used by the UI. Cache coverage upgrades include these new tables even when the Bungie version is unchanged.

Use “Objective” instead of “Target.” Collections say “Acquire” or “Collected,” never a numeric 1/1 goal. Weapon patterns use counts such as “5 patterns.” Other objectives retain their API descriptions and use units where explicitly identifiable (kills, encounters, chests, logs, wishes, banners, extractions, completions); singular unknown goals say “At least once,” and larger unknown goals use a neutral required count. Avoid guessing units from arbitrary triumph names. Armor comparison tooltips retain their collected/set-complete matrix.

Verification includes classification/perks/source/unit cases, cache coverage, browser group spans and tooltip wording, plus rendering against the local current manifest and a captured public profile. Native Safari remains a manual visual check.


## Redundant objective labels and badge acquisition — 2026-10-30

Header/cell tooltips omit generic Complete/Progress labels and a sole “The … raid completed” label, retaining goals, counts, status, and named multi-stage objectives. Generic Progress descriptions are also omitted. Badge requirement triumphs are identified by their collection node name plus matching trophy description or explicit associated-badge wording; this avoids confusing King's Fall's same-named raid completion triumph with its badge. They use “Objective: Acquire badge” and acquisition status instead of repeatable-goal wording or numeric 0/1 counters. The badge completion record exposes class-named objectives; this does not establish an explicit all-class gilding flag, so no gilded badge claim is added.


## Shared triumph tooltips — 2026-10-30

Treat a triumph’s header and numbered objective headers as one hover/focus group, and its cells for each guardian as a separate group. Anchor the tooltip to the group once; moving among its cells updates the bold objective without recreating or repositioning the tooltip. Hover includes cell padding. Whole-triumph headers and completed cells leave no individual objective emphasized. Keyboard focus follows the same behavior; Escape and leaving the group dismiss the tooltip. Pointer events still pass through tooltips. Build and all 19 Chromium scenarios passed, including fixed-position checks across header and player objectives.

## Armor ownership class logos — 2026-10-30

Use the class icons from each badge's existing class presentation nodes; no new manifest table or hardcoded class asset mapping. Armor cells show every owning class's logo, independently of the scoring class selector. Both ownership and full-set rows in the tooltip use the same logos, retaining class names as column headers and the quieter set row. Use theme-colored masks for the API's transparent white assets, with accessible class labels and an initial fallback if icon metadata is absent. Missing ownership remains distinct from uncollected armor. Verified the real assets against a captured public profile, plus the build, 27 unit tests, and all 19 Chromium scenarios.


## Clan emblem — 2026-10-30

Replace the sidebar placeholder with the clan’s actual square emblem, including collapsed mode. Resolve `detail.clanInfo.clanBannerData` using Bungie’s `/Destiny2/Clan/ClanBannerDictionary/` endpoint. Compose the selected gonfalon color, square detail layer, secondary decal layer, and primary decal layer with their API colors. Square assets keep the small sidebar logo legible; this is the web emblem rather than the full hanging banner.

Cache the dictionary for 24 hours and retain the resolved layers in the roster cache. Old roster entries upgrade on their next load. Optional banner failures preserve a cached emblem and do not block member data. Missing/incomplete definitions retain the placeholder. Verified λnomaly’s real emblem in expanded/collapsed layouts; build, 30 unit tests, and 20 Chromium scenarios passed, including warm cache reuse and failure fallback. API reference: https://bungie-net.github.io/multi/operation_get_Destiny2-GetClanBannerSource.html

## Independent browser catalog and three more raids — 2026-10-30

The JS site now owns `js/pages.jsonc`, an ordered catalog using the browser's node fields and supported rule overrides. The compiler reads this file, not the PHP `pages.json`, and validates page IDs, node hashes, and rule types. Copied only supported display/scoring rules and extra-content hashes; dropped legacy objective-numbering options and redundant elemental labels/orders. Parent `settings.json` still supplies the default clan and client API key. The PHP configuration is unchanged.

Added Crota's End (Swordbearer), Salvation's Edge (Iconoclast), and The Desert Perpetual (Atemporal), each with seal, badge, and full raid modes. Verified the node hashes against the current Bungie manifest, which matches the local snapshot. Include available weapon patterns, raid mods/exotics, and additional raid cosmetics; time-exclusive day-one emblems are unscored. Existing scope rules continue to exclude non-seal elemental triumphs from seal views. Normalize Prismatic after Strand and before same-class requirements. Distinguish Epic day-one achievements in their labels.

The Desert Perpetual has two parallel armor sets. Group the Collective Psyche and Wayward Psyche slots separately, with set-specific completion in armor tooltips; overall badge scoring still selects one whole class across the entire badge. It currently has no weapon-pattern records to add.

Verification: all 30 views build against the current manifest. Compared the original seven raids with their legacy configuration: heading order, labels, and scoring exclusions remain the same in every mode. Production build, 34 unit tests, and 21 Chromium scenarios pass, including all three new raids' navigation. Documentation describes the new catalog editing workflow.


## Activity seals and triumphs — 2026-10-31

Brought the legacy Activity group into the independent JS catalog: Crucible/Glorious, Iron Banner/Iron Lord, Gambit/Dredgen, Trials of Osiris/Flawless, Strikes/Conqueror, and Weapons/Deadeye. Keep the PHP catalog unchanged. The overview and sidebar separate Raids from Activities; links preserve an appropriate view when switching between the groups.

Activity pages have Seal and Triumphs views (`#/triumphs/<id>`), plus optional badges for Crucible, Gambit, and Trials. Triumph lists union seal requirements and the configured extra nodes/records, deduplicating IDs. They do not require a badge or mix badge collections into their progress, preserving the legacy hide-badge-unless-explicit behavior. Existing raid routes and scope remain supported.

Keep gilding requirements visibly labelled and included in the percentage, matching the legacy scoring; explain this in the activity footer rather than silently changing completion semantics. Title-holder counts continue to use the title completion record separately. Current manifest definitions contain all six seals and all configured extra nodes; current public profile components already cover these records.

Verification: all six seal/triumph pairs and three optional badges build against the current manifest. Build, 35 unit tests, and 22 Chromium scenarios cover activity navigation, seal/full scope, pages without badges, optional badges, gilding labels, and the existing raid UI.

## Completed, unclaimed triumphs — 2026-10-31

Completed records without the API's RecordRedeemed bit, and without ObjectiveNotCompleted, use a distinct mint-green cell and the tooltip note “Completed, but not claimed in game.” Progress remains complete; ordinary acquired collectibles are unaffected. When equally complete character records disagree about redemption, prefer a redeemed record rather than falsely reporting the triumph as unclaimed. Do not interpret partially completed interval records as an unclaimed whole triumph.

Confirmed BreakingBack's Special Operator record is state 0 with a completed objective (1691/500). Reference for the record state flags: https://bungie-net.github.io/multi/schema_Destiny-DestinyRecordState.html


## Record visibility and permission conditions — 2026-10-31

Keep flagged triumphs and their progress visible. Add a small corner marker for missing entitlement/permission (lock), hidden/invisible, obscured details, unavailable reward, or an equip-ready title. A plus indicates multiple flags; the tooltip lists every condition and explains it. One marker per guardian/triumph avoids repeating icons across each encounter stage. Existing unowned hatching and completed/unclaimed colors remain intact.

Do not call every missing entitlement “missing DLC”: DLC is one example of the permission restriction returned by Bungie. Missing/private profile data remains a separate state. Collectible state bits have different meanings and are not interpreted as record permissions. Reference: https://bungie-net.github.io/multi/schema_Destiny-DestinyRecordState.html


## Reduce condition noise — 2026-10-31

Removed RewardUnavailable and CanEquipTitle from cell indicators and tooltip notes at the user’s request. Their inconsistent presence does not offer a useful distinction here. Retain missing entitlement, hidden/invisible, obscured, and the separate completed-but-unclaimed treatment; raw API flags remain cached.
Valent has the Deadeye triumph Weapon Archivist with only one of these two statuses, while other triumphs for him have both statuses. The actual meaning isn't clear.


## Hidden watermark and collection headings — 2026-10-31

Center collection header names vertically for both single and multiple lines. Hidden triumphs use a faint eye-off watermark in each affected cell, behind readable progress. Locked and obscured conditions retain corner indicators (lock takes priority when both apply), while the tooltip continues to explain every condition. Unlike the PHP gray background override for restricted states, the watermark preserves the progress and completed/unclaimed colors.


## Header status markers — 2026-10-31

Replace Gilding and Not scored header labels with gold diagonal border stripes for gilding requirements and a small hollow diamond for unscored requirements. Neither treatment reserves title space; names remain vertically centered. Tooltips explain both statuses without implying that unscored triumphs are unavailable or less valuable.
Swapped to solid gold with an internal fade. Can revisit later.

## Expansion and seasonal migration — 2026-10-31

Added separate Expansions and Seasons & Episodes groups to the browser catalog. Expansion pages cover the Dreaming City, Shadowkeep, Beyond Light, 30th Anniversary, The Witch Queen, Lightfall, The Final Shape, The Edge of Fate, Renegades, and its Invasions title. Seasonal pages carry forward seasons 5–21 and add Witch, Wish, Echoes, Revenant, Heresy, Into the Light, Rite of the Nine, and Monument of Triumph (the newer season 28 entry). PHP configuration remains unchanged.

Preserve supported PHP display overrides, extra triumphs, and collectibles. Traverse configured triumph nodes recursively with shared-child/cycle protection; newer episode trees have multiple section levels. Keep collection badges as separate views for non-raid pages so an entire badge is not added to a triumph percentage. The Final Shape uses campaign, lost sectors, and world branches while its raid remains on the separate Salvation’s Edge page.

Derive the Legacy label at runtime from membership in Bungie’s Legacy Titles presentation tree (1881970629), rather than a configured flag, dates, or the `isSeasonal` field (which is primarily a Guardian Ranks display hint). Archived progress stays visible. The notice concerns earning the title; it does not claim that every associated item or individual triumph is unavailable. Older seasonal/episode triumph roots are also under Legacy Triumphs (3215903653); Monument of Triumph is in the active tree. The API’s SeasonDefinition confirms the episode names and their seal mappings.

This migration covers content with a manifest seal. Reclamation has a season definition but no seal mapping or dedicated triumph branch in the checked manifest, so no speculative page is added. The earliest seasons retain their seals and badges; a broader triumph view can only show the extra records still exposed/configured. Events, standalone legacy badges, and destination pages without seals remain outside this migration.

Validation: all new view combinations built against manifest 245114.26.10.13.2000-1-bnet.66137. Unit and browser coverage includes nested traversal, deduplication/cycles, manifest-derived legacy status, new categories, and navigation between seal, badge, and triumph views.

API reference: https://bungie-net.github.io/multi/schema_Destiny-Definitions-Presentation-DestinyPresentationNodeDefinition.html

## Collapsible sidebar sections — 2026-10-31

Each category has an independent, keyboard-accessible toggle. Initial load and navigation to another category open the current category and collapse the others; the overview defaults to Raids. Manual toggles can leave multiple categories open, and changing view within the same category preserves those choices. Section state is derived from the route on reload rather than stored as a separate preference. The existing whole-sidebar collapse remains independent.

## PHP moved to `php/` — 2026-10-31

The legacy PHP edition, its caches, and its settings moved from the repository root to `php/`. PHP resolves files from an `APP_ROOT` constant rather than the working directory. The browser edition now reads its own ignored `js/settings.json` (API key and clan id only) instead of the PHP settings. The only remaining cross-edition reference is the PHP progress comparison test, which reads `php/index.php`; remove it with the PHP edition.


## Lifetime gilding counts — 2026-10-31

Seal and broader triumph views automatically add a Times gilded column when the seal completion record links a gildingTrackingRecordHash. Read completedCount on that tracking record, not its objectives (current gilding requirements) or intervalsRedeemedCount. Show a plain numeric total, including 0; absent/null counts remain unavailable rather than fabricated zeroes. This informational column has no goal, completion state, or contribution to percentages, completion filters, or progress sorting. Badges keep their existing collection-only view.

API reference: https://bungie-net.github.io/multi/schema_Destiny-Components-Records-DestinyRecordComponent.html


## Table completion versus game requirements — 2026-10-31

Use Requirements for the seal view and Completion for broader triumph/full-raid and badge views. The percentage remains the site's average of included column progress; do not imply it is Bungie's seal completion rule. Remove excluded-column diamonds from headers, and identify exclusions in each column's tooltip instead. The summary header tooltip lists exclusions and explains base seal and gilding requirements. Read the base count threshold from the completion record objective, so 12-of-17 and similar seals are distinguished from all-required seals. Missing or ambiguous thresholds are not guessed. Additional gilding triumphs are distinguished from a higher threshold on the same seal set.

The guardian's summary cell tooltip shows complete and partially complete triumph counts, separate collection-column counts where applicable, and unavailable records. Do not label the remaining records not started: zero reported progress cannot establish that a player has not begun. Keep rows compact by placing the counts in these tooltips.

## Gilding header laurel — 2026-10-31

Replaced the gold border on gilding headers with a faint gold laurel wreath (crossed stems tied with a ribbon) centred behind the title. The manifest has no gilding background art: gilding triumphs reuse ordinary triumph icons, and the only gold artwork is each seal's own gilded emblem, which is too detailed for a header watermark. The laurel is original artwork in `src/assets/gilding-laurel.svg`, applied as a CSS mask so its colour stays in the stylesheet. The Times gilded column keeps the same treatment.

## Badge ownership markers and All triumphs — 2026-10-31

Badge pages show a guardian star once the full collection is acquired for at least one class. The star turns gold only when all three class collections are complete; absent class data cannot establish completion. Determine ownership independently of the selected class filter, and identify the completed classes in the guardian tooltip and accessible marker label. The badge legend distinguishes acquired badges from all-three-class completion.

Rename Triumphs to All triumphs while retaining the existing route URLs. Keep Full raid for combined raid views. Do not add Full activity: activity collection sources and availability span seasons, years, and legacy sets, so an aggregate collection view needs separate design.

## Legend and armor scoring explanation — 2026-10-31

Use spacing rather than small separator dots between legend entries. Replace the missing-record legend entry with the normal zero-progress pip; unavailable records retain their distinct cell/tooltip treatment.

When armor is collected for another class but not the class used for table progress, explain the unhighlighted background in the item tooltip. Show the scoring class icon/name and its armor collection percentage, distinguishing automatic best-class selection from an explicit class selection. Omit the percentage if armor data is incomplete. Ownership icons keep their existing meaning and colors; a muted amber explanation carries the additional context without introducing a warning icon or changing cell colors. Verified against cached BOBRA/Gambit data: the helmet is collected on Warlock while Hunter's 80% armor collection drives progress.

## Destinations and events — 2026-10-31

Keep destination/expansion equivalents together: Neomuna stays on Lightfall, for example. Move Dreaming City into Destinations without changing its ID, badge, or overrides. Add standalone Nessus, EDZ, Cosmodrome, Lost Sectors, Fishing, and Tangled Shore pages. Lost Sectors also includes the Pale Heart branch from the current manifest.

Add Events with the PHP catalog's event seals and historical event triumph pages, plus Heavy Metal, Arms Week, and Call to Arms from the current manifest. Pages without a seal open directly to All triumphs and have no title ownership, Seal tab, or invented seal requirements. Their completion value summarizes the displayed columns. Derive legacy status from Bungie's Legacy Triumphs tree for these pages, alongside the existing Legacy Titles detection for seals. Legacy is an archive classification, not a guarantee about every individual reward's availability.

Festival of the Lost 2021's configured node is absent from the current manifest; retain an explicit unavailable page instead of treating an empty table as completion. Revisit if historical definitions become a supported data source. No PHP data or code changed.

Verified all 23 destination/event entries against the cached manifest: 22 resolve, with the removed 2021 event intentionally unavailable. Unit coverage includes recursive standalone triumphs, legacy classification, missing data, config validation, and absent seal ownership; browser coverage exercises the new navigation and historical unavailable state.

## Event editions within event pages — 2026-10-31

Use one overview tile and sidebar entry per event. Historical records and medals are tabs within that event, ordered newest first, alongside its seal/triumphs view. Preserve existing historical route IDs as deep links and keep the parent event selected in navigation. Store `parentPageId` and `tabLabel` in the browser catalog; validate that edition parents are top-level events. Separate Festival of the Lost's 2022 records from the seal's additional records into their own tab. Keep edition navigation visible when a historical edition is unavailable, so visitors can return to other editions. There are now eight top-level event entries, with nine historical edition tabs.

## Unified event tabs and duplicate views — 2026-10-31

Place historical event years and medals in the same navigation row as Seal, Badge, and All triumphs. Historical views retain that complete row, including when records are unavailable. Remove the separate edition navigation level. Omit All triumphs whenever its columns match the seal, without a disabled tab or explanatory tooltip; this supersedes Undertaker's previous disabled-tab behavior. Existing duplicate-view URLs render the seal view. Festival of the Lost currently has the same 13 columns in both views; historical 2022 records remain on their own tab.

## Triumph seal membership — 2026-10-31

Index each triumph's seal membership using the requirement children of all title-awarding manifest nodes, including legacy seals and those without a configured site page. Do not infer membership from arbitrary presentation-tree placement or site completion overrides. Cache the derived index per definitions snapshot in memory; a new snapshot rebuilds it. Header and guardian-cell tooltips list seal names plus their awarded titles, including shared requirements such as Moments of Triumph. Membership stays out of the column header itself, and collectible and lifetime gilding-count headings do not gain this section.

## Consistent page headings and unavailable editions — 2026-10-31

Use Category / Page / View breadcrumbs throughout the tracker. Event editions use the parent event name and their year/medals label, with the event's seal title and title-holder summary shared across editions. Render the same heading and view navigation for configured pages during definition loading or when an edition is unavailable; show the loading/unavailable explanation in a styled notice below the tabs rather than switching to the generic centered error page.

Keep descriptions and legacy notices below view navigation, omit empty descriptions and the generic subtitle, and remove the heading's trailing title margin. Content length or wrapping may naturally increase space, but changing an event tab alone should not change the heading/tab position. Browser coverage compares the seal, available 2022, and unavailable 2021 Festival of the Lost tab positions at desktop and mobile widths.

## Seal membership sentences and stable tab widths — 2026-10-31

Describe membership as “This triumph is part of the … seal/seals.” Use natural conjunctions for multiple seals, emphasize the seal names, and keep differing awarded titles subdued in parentheses. Each view tab reserves the width of its bold label using an inaccessible hidden copy, with the visible label centered over it. Selection changes the text weight and background within that fixed footprint. Browser checks compare every tab's position and dimensions across event selections at desktop and mobile widths.

## Gilding layering and Hept Harmonies verification — 2026-10-31

Render the gilding laurel at a negative z-index within its sticky header cell, without elevating the heading button. The pinned Guardian header must cover gilding text during horizontal scrolling. A browser check overlaps the two and verifies the Guardian header receives hit testing.

Checked Hept Harmonies (record 2980025326) against Bungie's live manifest 245114.26.10.13.2000-1-bnet.66137: its description says seven attuned weapons, but objectiveHashes contains only five (Gizmo Weft, King Orfeo, The Heron, Micromort, Action Item), each requiring one. It has no interval objectives. Preserve the API data rather than inventing two missing requirements.

## Conditioned cell stacking — 2026-10-31

Give hidden/obscured/content-locked cells an isolated stacking context. Their positioned button (including progress numbers, zero-progress pips, and hover borders) stays above the watermark within the cell but below the sticky guardian column. A narrow-viewport browser test scrolls hidden partial-progress and obscured zero-progress gilding cells under guardian names while their hover borders remain active, checking both text and border overlap points.

## Completion-summary totals — 2026-10-31

Use “x of y triumphs complete” and “x of y items collected” to show the denominator without inferring that the remaining requirements have not been started. Retain the partial-triumph count unless all triumphs are complete, when the two lines become “All y triumphs complete.” Apply the same all-collected phrasing to items. Collection cells currently score ownership as zero or one for the scoring class, so partial collection cannot occur; omit a zero partial-items line. Keep missing public records explicit. Show seal/gilding requirements only in the Seal summary tooltip, alongside the existing badge-specific collection explanation on Badge; broader-view summaries describe only their table aggregation.

## Historical activity seals and Leviathan — 2026-10-31

Generalize parent-page tabs beyond events, requiring parent and child to share a category. Under Strikes, add Conqueror Seasons 12, 11, and 10, plus Legacy strikes using the PHP roots for Chosen, Hunt, and Tangled Shore. Under Trials, add Flawless Seasons 12, 11, and 10. Under Crucible, add Unbroken. These are actual legacy seal nodes, so their tabs open in Seal mode with their own title and requirements; historical triumph-only tabs use All triumphs. Keep the parent selected in the sidebar and preserve each edition's direct route.

Add one Leviathan entry under Raids with Leviathan, Crown of Sorrow, Menagerie, and Tribute Hall tabs, matching the old PHP grouping. The current Leviathan node already includes normal/Prestige completion triumphs for Leviathan, Eater of Worlds, and Spire of Stars, so do not fabricate separate empty raid pages. Add Scourge of the Past as a standalone triumph-only raid page using its six surviving Blacksmith requirements and the historical Moments of Triumph raid completion record. It has no standalone presentation node; this is the surviving set, not a reconstructed historical manifest. Derive legacy status for explicit-record-only pages from membership in Bungie's legacy triumph/title trees, rather than adding a configured legacy flag.

All thirteen added views resolve against the current cached manifest: three Conqueror versions, three Flawless versions, Unbroken, Legacy strikes, the four Leviathan views, and Scourge. Historical raid pages use triumph tabs rather than inventing seal or combined collection views.

## Status watermarks and view-specific headings — 2026-10-31

Use one centered condition watermark per cell, prioritized Content locked, Hidden in game, then Obscured in game. Remove corner condition icons and plus markers. Reuse the same glyphs before each status heading in record details, where all applicable conditions remain listed. Suppress a zero-progress pip when a condition watermark supplies the cell's visual marker; partial counts and completed checkmarks remain visible. Keep conditioned cells isolated below the pinned guardian column.

Seal views show the awarded title with a smaller muted “seal” suffix, a seal icon alongside the holder count, and the seal description. Badge views use the badge node's own name (falling back to the page name), the same styled “badge” suffix, and a count of guardians with the badge collected for any class, counted once per guardian. Do not add badge artwork or separate all-class ownership totals to the heading. All triumphs uses the parent page's name with a styled “triumphs” suffix, drops the title-holder tally, and omits the seal description. Keep the existing All triumphs tab wording and use legacy tabs/notices to distinguish archived records; do not call this a full activity view.

## Active-view notice and seal tally spacing — 2026-10-31

On the current All triumphs view, show an “Active triumphs” notice when its page has configured legacy editions. Explain that this view shows only active triumphs and legacy records are in separate tabs. Do not show that notice on Seal, Badge, or the archived editions themselves. Change the legacy seal notice's opening label from “Legacy title” to “Legacy seal,” retaining Bungie's Legacy Titles terminology when naming its manifest tree.

Make the seal image comparable to the height of the two-line holder count (64px desktop, 48px mobile), separated by 4px. Remove the tally's fixed minimum width and left-align its contents, so a short number sits close to the seal and larger counts grow naturally.

## Dungeons and exotic mission levels — 2026-10-31

Add Dungeons and Exotic missions as collapsible sidebar/overview categories. Migrate the PHP dungeon pages and their supported display rules, catalysts, and selected random collection drops; correct the internal Pit of Heresy spelling. Extend dungeon coverage through Warlord's Ruin, Vesper's Host, Sundered Doctrine, and Equilibrium using their manifest seal, triumph, and badge nodes. Older dungeons without seals remain triumph-only pages. Dungeons with seals/badges offer Seal, Badge, and Full dungeon; reuse the combined-view data pipeline and class-set scoring behind Full raid, with dungeon-specific visible labels. Do not infer a full historical loot pool for older dungeons without a badge node. Add named current Combat dungeon challenges that live outside the activity's own tree.

Migrate Harbinger, Presage, Vox Obscura, Operation: Seraph's Shield, and //node.ovrd.AVALON//. Add The Whisper, Zero Hour, Starcrossed, Encore, Kell's Fall, Dual Destiny, Oblation, Fire and Ice, Whetstone, The Other Side, and Wild Card using their named mission nodes or explicitly identified surviving triumphs. Include named mission-specific Combat triumphs without importing the entire Combat: Exotic Missions category. Presage's current Combat/catalyst records are the main view; preserve its original quest tree as a Legacy triumphs tab. Keep manifest-derived archive classification, which describes the triumph records rather than asserting that the mission itself is unavailable. Some mission levels have only one or two surviving triumphs; show those without inventing additional objectives.

Verified all eleven dungeon pages in each available view and all sixteen mission pages plus the Presage historical tab against the cached manifest; every view resolves. Catalog compilation and browser coverage include the new categories, Seal/Badge/Full dungeon navigation, a seal-less dungeon, a newer mission, and current-versus-archived mission navigation.

## String variable rendering and regression guard — 2026-10-31

Request StringVariables (profile component 1200) alongside the existing components; profiles cached before this component was requested refresh through the normal component-version check. Bungie documents `{var:hash}` placeholders as per-account/per-character integer substitutions. Keep raw manifest definitions cached unchanged, and resolve display strings when building page headings/objectives, including interval objectives such as Never De-Feated on Praxic. Shared table headings use a value only when the available account/character values agree; unavailable or conflicting substitutions render `?`, never a guessed number or the raw token. Preserve valid zero values and all objective targets/progress calculations.

Add the actual Never De-Feated record and five interval-objective definitions as a compact fixture. Unit checks cover interval rendering, missing/conflicting variables, zero, and manifest immutability. Browser coverage checks the Praxic page, accessibility labels, header and guardian-cell tooltips, and cached reloads with and without available variables. A shared browser guard checks for unresolved `{var:` text/accessible labels after readiness and at the end of every test, so the check also applies to other pages.

## Per-player string variable substitution — 2026-10-31

Keep an unresolved selected-page template separate from its shared-header display copy. Each guardian row resolves its heading/objective text from that player's variables. For character-scoped triumphs, identify the same character selected by the existing record-selection logic and let that character's variables override account values; account-scoped records prefer the account values, with agreed character values as fallback. Do not mix values between guardians or choose a different character just for display. Row tooltips, accessible labels, and click-opened details use the row-specific heading. Shared header tooltips continue to require agreement across available player/character values. Tests cover three different guardian values including zero, two competing character records, account-versus-character precedence, and cached reloads.

## Strict player scope for variables — 2026-10-31

Player-supplied variables are exclusively for that player's cells, tooltips, accessible labels, and details. Shared headers, page descriptions, overview metadata, and badge names never consult player variables, even if every loaded player has the same value. Unavailable substitutions in those shared contexts remain `?`. This supersedes the earlier agreement-across-players behavior. Character agreement remains only as a fallback inside one player's data. Regression coverage explicitly supplies the same variable value to every player and verifies that shared header tooltips still show `?` while player tooltips show their own value.

## Badge artwork beside ownership counts — 2026-11-01

Show the badge node's image beside the badge-owner count on Badge views, superseding the earlier decision to omit badge artwork there. Share the seal image's responsive size and close spacing, using contain sizing to preserve rectangular badge proportions. Keep the seal-specific downward optical adjustment separate. This change is to the badge-page heading, not overview tile artwork.

### Other: Guardian ranks, commendations, and checklists

- Other contains two pages: Guardian ranks and Checklists. Individual requirements/checklists use the existing flat tab navigation rather than separate sidebar entries.
- Guardian ranks has a summary of current, renewed, and lifetime-highest rank; separate tabs for ranks 2–11; and a Commendations tab. Rank 1 has no requirements, and there is no combined early-ranks view. Requirement nodes come from `DestinyGuardianRankDefinition`, rather than PHP's older record lists.
- The current [Bungie API schema](https://github.com/Bungie-net/api) and a public profile expose those three rank values, but no season-by-season rank history. We therefore do not construct a history table. Recording our own snapshots would be a separate future feature; those would not reconstruct earlier seasons. Rank descriptions avoid promising the old seasonal reset rules, which have changed since the original schema descriptions were written.
- Commendations are separate from ranks, with no completion goal or percentage. Category names and colors come from the manifest: Ally (green), Mastery (orange), Fun (pink), and Leadership (blue). Category scores, individual cards, and available category percentages are shown, with card activities in tooltips. Total score includes retained score from earlier seasons; the other columns describe the current breakdown. Zero is a valid numeric value; absent fields remain unavailable.
- Checklists include all 22 definitions currently exposed by the API. Tabs run oldest to newest, with the multi-era Region Chests and Lost Sectors first, followed by Forsaken through Renegades. Within a release, related checklists stay together. This intentionally moves Neomuna after the older content.
- Account checklist booleans come from component 104. Character checklists come from component 202 and select the most complete whole character checklist, without combining entries across characters. Missing entries remain unavailable rather than becoming uncollected. Commendations use component 1400.
- Existing cached profiles and definitions are upgraded automatically to fetch these additional components/tables. Definition snapshots remain atomic; a failed new-table download retains the last usable snapshot.

## Overscroll jitter investigation — 2026-11-01

Page overscroll jitter is Safari behavior, not this app's layout or code. Tested in Safari with console overrides and local test pages; no app code changed.

- Removing the outer-layout suspects did not help, individually or together: the sticky sidebar, the table's own rubber band, sticky table headers and player column, the sidebar backdrop, and the viewport-height chains. Neither did blocking hover handlers, disabling pointer interaction, or removing `theme-color`.
- Replacing the whole page with a plain tall div still jittered, as did a production build (`vite preview`), so neither the app content nor the Vite dev client is required.
- The live Book Info Lookup build, served locally, was smooth in a fresh tab. After visiting another page in the same tab it snapped sideways, with identical files. Sideways snapping therefore follows back history in the tab: horizontal overscroll competes with Safari's swipe-back gesture. Hash routing adds a history entry per in-app navigation, so this app usually has back history.
- In a fresh tab with no history, pages snap only to the top, and only when the page can scroll vertically. A plain 3000 px page with no stylesheet or script snaps in Safari, and so does live jpearson.dev once its results make the page scroll; it stops when the page fits the window again. Collapsing this app's sidebar appeared to fix it only because the page then fit the window. Sticky positioning is not the trigger: tall sticky, short sticky, and tall static sidebar test pages all snapped in Safari. Chrome did not snap on the tall sticky page.
- `overscroll-behavior-x: none` on the root stops the sideways snapping but also disables swipe-back navigation, so it is not applied.

The audit also found that the sticky sidebar is taller than the window (about 1,100–1,350 px), so its lower sections are unreachable mid-page on long pages. That is a separate layout issue worth fixing on its own, not a jitter cause. Per-edge overscroll colors stay deferred.

## Additional Other collection pages — 2026-11-02

Added Catalysts, Patterns, Exotic weapons, Exotic armor, and Mods as five pages under Other. Each shows its complete current manifest subtree, with native column groups: catalysts/exotic weapons by kinetic–energy–power, patterns by weapon type, exotic armor by class, and mods by equipment/category. These are independent collection items, rather than badge-style parallel class sets; collecting one class's exotic does not count for another class.

Roots come from the current presentation tree instead of copying PHP's leaf lists. This includes newer pattern categories and the replacement Weapons mod node (`1627803277` rather than PHP's old `3839307707`). No old catalyst suppression overrides were carried over. Current manifest entries are shown as supplied, including their visibility/lock conditions. Pattern objectives retain their pattern units even when the visible column group is a weapon type. Mod details preserve perks and distinguish weapon/ghost mods from armor mods.

Migration work and remaining candidates are tracked in `MIGRATION_STATUS.md`; deferred notes remain there.

## Catalyst insertion display — 2026-11-02

For records typed Exotic Catalysts, hide objectives labeled “Insert the Catalyst” from table subcolumns. Keep the original objectives in the model, percentage calculations, and header/player tooltips. One remaining visible objective has no numbered subheader; multiple visible objectives retain their original positions (for example, 2 and 3). Apply this presentation rule wherever the catalyst record appears, including activity pages. The API's insertion target is 2 for the current matching definitions; its internal interpretation remains unverified.

## Exotic weapon collection variants — 2026-11-02

On the Exotic weapons page, collapse collection entries that reference the exact same weapon item hash. Keep all alternative collectible identifiers, count ownership of either version once, and preserve unavailable status when no owned version is known and an alternative's data is missing. Do not merge different item hashes merely because names match, or treat alternatives as badge class slots.

Associate a weapon with a uniquely named Weapon Pattern record for the header's “Pattern available” label and player tooltip. Report whether that pattern unlocks the craftable version; do not infer that unlocking a pattern proves a crafted instance was made or retained. The current manifest has 12 duplicate pairs, reducing 157 collectible columns to 145 weapon columns. No extra profile components or cache migration are required.

## Raid and legacy mod groups — 2026-11-02

Split the Mods page's Legacy and Raid subtree by collectible source: each raid has its own header, with separate Nightmare Hunts and Dreaming City headers. Normalize source quoting and escaped apostrophes. Fall back to the item's raid-specific mod type, then Legacy mods, if the source is incomplete. Keep each group contiguous without changing which items count toward collection progress.

## Miscellaneous seals, badges, and Moments — 2026-11-02

Added Other badges and Other seals as independent sidebar/overview categories. Other badges contains the six Red War/Curse and Warmind/Forsaken destination and exotic badges, plus The Pantheon badge. Other seals contains Chronicler, Wayfarer, Legend, and The Pantheon, with Godsbane and Godslayer sharing tabs. Standalone badges open directly in badge mode, with their normal ownership, class-set, tooltip, and collection summaries.

Moved Monument of Triumph from Seasons & Episodes into Other, retaining its existing page ID/URL. Its page is named Moments of Triumph and has flat tabs for the Monument seal, Monument triumphs, and the available 2024–2019 Moments seals. The seal suffix and title-holder count remain available on Other's seal tabs. Seal requirement tooltips use the API's thresholds, including seals that require fewer than all listed triumphs. Removed the misleading season number from Monument.

Verified every added page against the current manifest. All named seals and all entries in the Badges root now have catalog coverage; the unnamed/redacted seal is excluded. Broader triumph-tree coverage remains a separate migration task.

## Monument gilding status and category headers — 2026-11-02

Immortal uses a Gilded status column rather than a lifetime count: the normal check mark for gilded, no-progress pip for not gilded, and dash for unavailable data. Use completion or a positive completed count on its linked character-scoped tracking record, taking an earned status from any character. Keep it excluded from completion, with a boolean tie-breaker after overall progress; other seals retain Times gilded.

In Monument's expanded triumphs view, retain the seal's category-summary records under Seal requirements and group the underlying triumphs by their native parent/category paths, such as Worlds: Vistas or Teamwork: Raid Challenges. Keep those groups contiguous and use the existing sticky shared-header behavior. The expanded view's heading now names Monument of Triumph rather than the historical Moments umbrella.

## Moments category adjustment — 2026-11-02

Moved the Moments/Monument page and all its historical editions from Other to Other seals. Existing page IDs, URLs, and tabs are unchanged.

## Lifetime — 2026-11-02

Added Lifetime as the first page in Other. Use the complete current Lifetime presentation root (203 triumphs), with All lifetime, New Light, Titan, Hunter, Warlock, Social, Cooperative, and Competitive tabs. This includes the broader Social/Cooperative/Competitive content rather than only PHP’s New Light and class leaf lists. Column groups follow native record categories; character-scoped triumphs retain the existing best-whole-record policy.

## Curated catalog coverage test — 2026-11-02

Added a strict coverage audit using the actual page builder and the compiled public catalog. Check current and legacy Triumphs, patterns/catalysts, Guardian Ranks, seal requirements, every badge in the Badges root, and all named active/legacy seals. Missing entries and unusable views fail with hashes, names, and source paths. Tests also prove that deleting pages, adding a new unmapped triumph, or breaking a referenced badge causes a failure. No missing-record allowlist is used.

Pin a compressed, minimal public-definition snapshot for deterministic offline unit tests, with independent commands to refresh it or audit Bungie's latest manifest without changing the fixture. The test does not depend on PHP caches or credentials. Lore and current Medals are separate sibling trees and remain outside the triumph coverage assertion; the initial broader audit found 1,104 lore records and 341 medals not represented. Orphan/internal records and unnamed titles are not curated public triumphs/seals. These scope distinctions are documented in README rather than silently treating everything in DestinyRecordDefinition as a triumph.

## Request failure diagnostics — 2026-11-02

Attach structured transport diagnostics to cached `errorInfo`, log a console warning per failed request/attempt, and retain the latest 50 failures under `diagnostic:` keys in the existing IndexedDB entries store. Separate history preserves incidents after recovery and handles failures without a prior cached profile. Include URL, timing, attempt/retry details, HTTP status/content type, Bungie error metadata, and bounded excerpts for unreadable responses. Redact the API key, omit request headers and successful payloads, and do not copy JSON error envelopes' Response data. Cache clearing removes the history; storage failures use the existing memory fallback. Keep the existing request retry policy.

### Public clan selection

Public clan search and browser-owned clan selection are implemented. The configured clan is the initial default; visitors can search names, IDs, or Bungie clan links and select another clan. Keep seven deduplicated recent clans with last-viewed dates. Preserve intentional clan preferences when clearing disposable API caches. Scope sync summaries by clan and ignore late results from a previous selection.

Player login remains separate: it will identify and prioritize the visitor's own clan and enable friend-clan suggestions and friend/combined lists. Do not label a publicly selected clan as the visitor's own clan.

### Player login — 2026-11-03

Use Bungie's Public OAuth client from the browser, without a client secret or server proxy. Select the primary-save clan on a new login and prioritize it in clan suggestions. Friends' clan suggestions and alternative player lists remain separate work.

Keep the access token in tab session storage and authenticated profile payloads in a separate memory-only cache. Attach Bearer credentials only to account verification and the signed-in player's verified profile IDs. All other players use public requests and the existing public cache; clan membership or friendship grants no additional progression/activity access. No inventory components are added. Logout and expiry invalidate pending UI updates, discard private values, and return to public data. Public-client tokens have no refresh token; require reauthentication at expiry.

Local OAuth requires HTTPS. Vite enables a self-signed development certificate when the configured redirect uses HTTPS; the redirect URL and registered browser origin must both use the HTTPS address. Plain HTTP on the development port redirects to the configured HTTPS origin while preserving the requested route; the listener also retains native HTTPS and Vite HMR. Never export client secrets through the settings compiler.

### Friends’ clan suggestions — 2026-11-03

Load accepted Bungie friends after login with ReadUserData, retaining social relationships only in session memory. Resolve their clans using public membership-to-clan endpoints with three concurrent requests and short session caches. Suggestions show up to three friend names with a remaining count, deduplicate against recents/default, and keep the visitor’s own clan first without extra labels. Preserve partial results and expose retry failures in the chooser.

Bungie provides current presence and last-used membership, but no last-active timestamp in this list. Do not invent activity dates or fetch every friend’s full profile merely for clan suggestions. Friend-player lists remain deferred.

### Cross-save clan memberships and friend reasons — 2026-11-03

Keep separate roster memberships visible. When a roster platform differs from its cross-save override, label that row with the joined platform; account details explain which primary save supplies progress. Apply the label on both progress tables and Members. Clan 2231282 currently has the same Bungie account joined through Stadia and Xbox, both reporting a Stadia cross-save override; matching progress is expected. No deduplication is introduced.

Friend-clan reasons use three entries at most: when more than three friends share a clan, show two names and “x more” instead of a third name plus another count.

When cross-save is disabled, label the roster platform if public linked memberships confirm multiple Destiny platforms. The roster’s applicableMembershipTypes only lists the current platform in this case, so use the existing cached public membership endpoint in the background. A single-platform account stays unlabelled. Each independent membership continues to request its own profile, and no “Primary save” label is invented.

### Collapsing overridden clan memberships — 2026-11-03

Combine roster rows sharing a Bungie account ID and the same nonzero cross-save override. Prefer the primary-save membership when present; retain other clan memberships as display-only metadata for guardian tooltips, explicitly noting that those saves are overridden. Apply the grouping to progress tables, Members/CSV, guardian counts and title/badge owner counts. Keep sync/cache entries scoped to their original memberships. Unknown identities, independent saves without cross-save, and inconsistent override values stay separate.

### Player-list selector — 2026-11-03

Add Selected clan, My friends, and My clan and friends to the sidebar. The combined mode always uses the signed-in player’s own clan, without overwriting the separately saved selected clan. Deduplicate friends overlapping the same clan save while retaining clan membership metadata; preserve independent saves. Resolve friend profiles publicly, with authenticated requests still restricted to the signed-in player. Keep list assembly and social metadata in memory, scope pass summaries to list/account, and return to Selected clan immediately on logout or expiry. Store only the mode preference.

Load the friend list independently of friend-clan suggestions to avoid waiting for those lookups. Use cached public membership resolution and bounded concurrency. No public Destiny membership means an unavailable row, not a guessed profile request. Presence without a Destiny 2 flag does not establish current game activity; unknown activity retains the five-minute profile policy.

### Lint and format tooling — 2026-11-03

Use Prettier defaults plus `singleQuote`, pinned to an exact version because formatting can change between releases. Markdown and test fixtures are excluded. ESLint uses the recommended JS, TypeScript, and Vue configs, with `eslint-config-prettier` to avoid rule conflicts. Type-aware rules are left off for now. There are no pre-commit hooks.

Prettier treats a line break between inline elements as equal to a space, but Vue's compiler removes whitespace that contains a line break. A space that must render between two inline elements should be written as `{{ ' ' }}`.

The rank in the guardian tooltip says "Clan Admin" only in the combined list, where friends are also shown. The clan-only list says "Admin".

### App structure and shared state — 2026-11-04

`App.vue` is a thin shell. Shared state and actions live in one store, `useTracker.ts`, created once with `provideTracker()` and read with `useTracker()` through provide/inject. Page-level components use the store (`AppHeader`, `AppSidebar`, `PageHeading`, `HomePage`, `SealPage`, `SealTable`, `TooltipLayer`). Leaf components that show config plus one profile keep plain props. `usePageView.ts` holds everything derived from the route and definitions before player data; `useTableRows.ts` builds rows.

Rows build in two stages: per-player rows, then filter, sort, and the platform label. Search, filter, and sort changes reuse the built cells, and linked-platform lookups do not rebuild them.

Keep large data in `shallowRef`. The table must not read `tooltip` directly: every cell would then rerender on each tooltip change. It reads computed IDs that change only when a tooltip opens or closes, and `leaveRecordTooltip` leaves the tooltip open when moving to another target, because Vue can flush between `mouseleave` and `mouseenter`. Measured across 4 cell moves: 6 table rerenders before, 0 after.

### Accessibility pass — 2026-11-04

Text meets 4.5:1 and single-symbol marks (`·`, `—`, `●`, `✦`) meet 3:1 on their darkest background, checked across the main pages, tooltips, detail panel, members page, and clan picker. Failing colors were darkened by the smallest step that passes, keeping their hue. Hover states were not scanned. The focus ring is `#5e8a3c`, at least 3.4:1 on the light page and the dark header.

Text fields keep the lighter `#9bb976` ring, because the caret also shows focus. Selects have no caret, so they add a darker bottom edge. The clan ID in the picker is a deliberate exception at about 2.9:1: it is debug detail, not content. `prefers-contrast: more` strengthens both, so no in-app contrast setting is needed for now.

`aria-describedby` is set directly on the tooltip's target rather than bound in templates. Only the real target is described, and the table no longer rerenders when a tooltip opens or closes.

The skip link focuses `main` in a click handler, because a plain `#main` link would change the hash route. The live region covers the sync heading only, so screen readers are not told every profile count during a sync.

The progress table is a `role="grid"` with one Tab stop: arrow keys, Home, and End move between cells, and Ctrl+Home/End go to the first and last cell (`useGridNavigation.ts`). Cell positions come from a grid map, so spanning headers line up. Moves scroll targets clear of the sticky header and player column, and keep the tooltip open while scrolling. Retry buttons stay in the Tab order. The members table is unchanged.

Tooltip headings stay `h3`: they are transient and outside the page outline, so axe's heading-order and region notes for them are accepted.

### Dependency updates — 2026-11-04

Updated to Vite 8, TypeScript 6, and `@types/node` 26. TypeScript 7 is on hold because `typescript-eslint` requires below 6.1 and `vue-tsc` depends on the TypeScript API. Revisit when both support it.

`overrides` forces `minimatch` to 11 for the `GHSA-g3hv-75wg-m249` advisory, because ESLint and `typescript-eslint` still request 10. This is development-only. Remove the override once both request a fixed version.

### App frame layout — 2026-11-10

The header, shell, sidebar box, and `main` are styled in one "App frame" section of `style.css`, ordered by element and then breakpoint. It replaced about 95 rules spread over four earlier passes, several of which could never apply. A computed-style comparison of every frame element across five widths, both sidebar states, and the syncing header confirmed the consolidation changed nothing. The sidebar's own contents stay with their component rules.

The sidebar is sticky and capped at the window height below the header, scrolling on its own, so every section is reachable partway down a long page. Its direct children do not shrink, so overflow scrolls instead of squeezing sections. The rail background stays on `.shell::before`. A tall sidebar also no longer stretches short pages.

On phones the open sidebar's Players select leaves room for the collapse toggle, which the select previously covered.

### Menu button and phone drawer — 2026-11-10

The sidebar toggle is a menu button at the start of the top bar. On wider screens it collapses the rail (a saved preference); at 700 px and below it opens the sidebar as a drawer instead, with no rail or stacked sidebar. The drawer closes on navigation, Esc, its close button, or a tap outside; the page behind it is inert, and focus moves into it and back to the menu button. When the header scrolls away, a floating copy of the button appears, straddling the rail's edge (or as a tab on the screen's left edge on phones), so no reveal-on-scroll header is needed.

The sticky sidebar's height grows into the header's space as the header scrolls away (`--header-scrolled`), so no gap is left below it. The Players selector is labelled "Players shown", follows the clan and login controls, and is hidden while signed out, when only the selected clan can be shown.

### Collapsed rail name in Safari — 2026-11-10

WebKit measures vertical text (`writing-mode: vertical-rl`) as 0 wide when a parent shrinks to fit it. The collapsed rail's identity block used to shrink-wrap (`margin: 0 auto`, `align-items: center`), so in Safari the name's wrapper collapsed to 0 px at the rail's center and the name overflowed to the right, where the scrolling sidebar clipped it. The identity block and the name's wrapper now span the rail's width, and the name centers itself. Do not reintroduce shrink-to-fit around the vertical name. `text-orientation: sideways` stays, so punctuation such as the apostrophe in "Crow’s friends" turns with the letters.

The collapsed name has no height limit or ellipsis; a short window scrolls the rail instead.

