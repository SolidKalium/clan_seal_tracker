# Migration Tasks Remaining

## TODO list

**Main page:**
- Remaining candidates from the original Other section
  - Potentially: the unimplemented (or maybe partially implemented) milestones page (might or might not require being logged in, at least for some info)
  - Potentially: other medals
  - Seasonal challenges might look different now. Certainly, the old seasons have been removed. Challenges might exist in a "non-season" way now
- A test case to verify all triumphs, badges, and seals in the manifest's tree show up somewhere in the main json.

**Members page:**
- Might remain on a "hidden path" or require being logged in as someone in the clan (when that is supported), since it lists entitlements and similar things.

**Misc:**
- Check for data not made visible by this site
  - For instance, metrics
- A seal overview page (would probably show player progress on all seals, which would be more calculations than at present)
- Clan selection
- Player login

**Cleanup pass:**
- Review page high-level structure
- CSS
- Tree shake
- Check resource usage and for any hot points
  - Page has been freezing up during automated dev work recently, to the point Chrome calls it unresponsive, even twice back to back. That's a potential sign that dependencies are excessive, but it could just be based on the json updating and forcing everything cached to be evicted in case it actually changed; in that case, trying to cache parts of the json to limit dev refreshed might be excessive for the final build, unless it can be easily optimized out for that and is simple to implement.

## Revisit list

- [ ] Consider distinct subtitles for overview sections when they add useful context.
- [ ] Consider how to explain ordering and relationships within categories, including expansion releases, mid-year releases, and multiple seals from one expansion; avoid implying that each page is a separate expansion.

Recorded 2026-10-30. Deferred polish and interaction design; these are not requests for immediate implementation.

- [ ] Revisit table overscroll appearance, especially Safari's rubber-band effect. Moving the border onto the table substantially improved it; the current result is acceptable for now.
  - [ ] Page right-edge overscroll still uses a uniform browser canvas color rather than matching header/content bands. Oversized header/page paint extensions did not fix it and were reverted after a jitter report. Favor stable native scrolling over more paint/compositor workarounds.
  - [ ] Consider making the table rubberband shift the opposite edge into its margin? Might not be possible.
  - [ ] Consider making the scrollbar for the other dimension track with the table rubberbanding overscroll content. Might not be possible.
- [ ] Retest page overscroll jitter after updating Safari (see "Overscroll jitter investigation — 2026-11-01"). Sideways snapping follows back history in the tab; top snapping happens on any vertically scrollable page. If it persists, file with Apple using a plain 3000 px page with no stylesheet or script, opened in a fresh tab.
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
- [ ] Show score, rewards, or other details on triumph heading tooltips. Could show preview of armor or weapons.
  - [ ] Do any ghost mods still expire? Can show energy needed either way.
- [ ] Double check for any signs of season-by-season guardian rank history. Game might only show immediate past season to the player themself. Or it could be a feature only for a logged-in player.
- [ ] Make pages more searchable or allow finding a page via multiple interaction paths (e.g. from a list of all badges vs the tab for a badge on raid or expansion) (Might be part of a larger reorganization, such as allowing viewing triumphs / medals in the hierarchy the game natively uses as a second view.)
- [ ] Is a hash (`/#/foo/bar) really the right approach instead of using normal paths?
- [ ] Should seals with lower requirments than 100% of triumphs calculate differently or have a toggle for how that is handled?
- [ ] Something to "pull forward" all columns that someone is missing. Might need to break the top-level table headers

## Known quirks

Recorded 2026-11-01. Observations and uncertainties to retain; no immediate implementation is planned.

- **Character-scoped triumphs show the best whole record.** For each triumph, the site selects the character record with the highest aggregate progress; it does not merge objectives across characters. The user recalls that the game may display this best-record result across all characters, but that recollection is unverified. This can matter for requirements such as collecting feathers x/9 when all feathers must be collected on one character: the summary does not show how the other characters differ. Low priority: consider an indication of differing character records or a per-character breakdown when such differences exist, without implying that progress can be combined. Some separate options: "debug" alert in html or console when this is noticed, possibly for noting in the page json; automatically showing on the cell for the affected player; labelling the column automatically or from the json.
- Catalysts with "Insert the catalyst" objective typically or always require a count of 2. Why? The measured value might actually be "bool acquire catalyst" + "int insert count" or something like that.
- Some exotic weapons, have two versions for ownership. See Wish-keeper, Barrow-dyad, Whisper of the Worm, etc. One is the plain exotic weapon and the other is the craftable version. We could consider labeling which is which in the future, if know the situation.
