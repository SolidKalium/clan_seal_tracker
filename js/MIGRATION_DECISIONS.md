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
  - [ ] Page right-edge overscroll still uses a uniform browser canvas color rather than matching header/content bands. Oversized header/page paint extensions did not fix it and were reverted after a jitter report. Favor stable native scrolling over more paint/compositor workarounds.
  - [ ] Consider making the table rubberband shift the opposite edge into its margin? Might not be possible.
  - [ ] Consider making the scrollbar for the other dimension track with the table rubberbanding overscroll content. Might not be possible.
- [ ] Shrink tooltips and review their information density. Keep them useful for quick inspection without obscuring large portions of the table.
  - [ ] Overall compactness can also be considered. For reference, the PHP version for Rivensbane seal and the current 27-member Anomaly clan fits with plenty of vertical margin and a small amount of horizontal margin on a full screen view. Someone might like more breathing room, but likely not at the cost of difficulty of use. So usability features like pinning some players or a compactness toggle could allow a view that is less compact.
  - [ ] Can also have a setting to show counts instead of checkmarks
- [ ] Remove or redesign click-on-cell behavior. The current pinned detail panel is provisional. Possible actions include navigating to a player page or opening a modal with richer triumph/collectible details, such as relevant YouTube guides. Exact action, context, and content sources remain undecided. May depend on tap vs click.
- [ ] Revisit activity / page-type breadcrumb dropdowns when more page types are added.
- [ ] Show guardian last login in tooltip?
- [ ] Show an indicator outside of the tooltip when a guardian's data becomes stale?
- [ ] Show a clan's emblem when a clan is selected?
- [ ] Allow pinning guardians to the top?
- [ ] Move or shrink headers? Main header can be shorter on desktop. Search and sort might or might not be collapsible or otherwise shrink out of the way. Left sidebar should be collapsible. Maybe just show clan logo, with clan name rotated to be vertical. Icons can replace some of the links there, but site navigation needs to be figured out first.
- [ ] Consider additional text overrides for poor descriptions on seals, collections, etc.
- [ ] Consider a new favicon?
- [ ] Consider optional per-clan styling for the page, based on the clan's colors.
- [ ] Option to show progress without gilding. Could also allow a "full completion" mode that includes day 1 or any other excluded entries.
- [ ] Improve gilding requirement column header styling

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
