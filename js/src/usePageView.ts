import { computed, type Ref, type ShallowRef } from 'vue';
import { catalog, catalogGroups } from './catalog';
import { buildSeal, buildSealTemplate, type PageMode } from './domain';
import { resolveSealStrings, resolveStringVariables } from './stringVariables';
import type { Definitions, PageConfig } from './types';

/** Everything derived from the route and game definitions, before any player data. */
export function usePageView(
  hash: Ref<string>,
  definitions: ShallowRef<Definitions | undefined>,
) {
  const isMembers = computed(() => /^#\/members\/?$/.test(hash.value));
  const routeMode = computed<PageMode>(() => {
    const mode =
      (/^#\/(badge|raid|triumphs)\//.exec(hash.value)?.[1] as PageMode) ||
      'seal';
    const id = /^#\/(?:seal|badge|raid|triumphs)\/(.+)$/.exec(hash.value)?.[1];
    const page = catalog.find((p) => p.id === id);
    if (page?.category === 'Other badges') return 'badge';
    if (mode === 'seal' && page && !page.sealNodeHash) return 'triumphs';
    return mode === 'triumphs' && page && hasDuplicateTriumphs(page)
      ? 'seal'
      : mode;
  });
  const routeId = computed(
    () => /^#\/(?:seal|badge|raid|triumphs)\/(.+)$/.exec(hash.value)?.[1] ?? '',
  );
  const groupedPage = computed(() => {
    const page = catalog.find((p) => p.id === routeId.value);
    return page &&
      (page.parentPageId || catalog.some((p) => p.parentPageId === page.id))
      ? catalog.find((p) => p.id === (page.parentPageId ?? page.id))
      : undefined;
  });
  const pageEditions = computed(() =>
    groupedPage.value
      ? [
          groupedPage.value,
          ...catalog
            .filter((p) => p.parentPageId === groupedPage.value!.id)
            .sort((a, b) =>
              groupedPage.value?.category === 'Events'
                ? (b.tabLabel ?? '').localeCompare(a.tabLabel ?? '')
                : 0,
            ),
        ]
      : [],
  );
  const isHome = computed(
    () => !hash.value || hash.value === '#' || hash.value === '#/',
  );
  const seals = computed(() =>
    definitions.value
      ? catalog.map((page) => buildSeal(page, definitions.value!, 'seal'))
      : [],
  );
  const sealsById = computed(() =>
    Object.fromEntries(seals.value.map((s) => [s.page.id, s])),
  );
  function hasDuplicateTriumphs(page: PageConfig): boolean {
    if (!page.sealNodeHash || !definitions.value) return false;
    const seal = buildSeal(page, definitions.value),
      full = buildSeal(page, definitions.value, 'triumphs');
    return (
      !seal.unavailable &&
      !full.unavailable &&
      seal.headings.length === full.headings.length &&
      seal.headings.every((h) =>
        full.headings.some((other) => other.hash === h.hash),
      )
    );
  }
  function pageMode(page: PageConfig): PageMode {
    if (page.category === 'Other badges') return 'badge';
    if (
      (routeMode.value === 'seal' && page.sealNodeHash) ||
      (routeMode.value === 'badge' && page.badgeNodeHash)
    )
      return routeMode.value;
    return hasDuplicateTriumphs(page)
      ? 'seal'
      : ['Raid seals', 'Dungeons'].includes(page.category) && page.sealNodeHash
        ? 'raid'
        : 'triumphs';
  }
  const selectedTemplate = computed(() => {
    const page = catalog.find((p) => p.id === routeId.value);
    return page && definitions.value
      ? buildSealTemplate(page, definitions.value, routeMode.value)
      : undefined;
  });
  const selected = computed(() =>
    selectedTemplate.value
      ? resolveSealStrings(selectedTemplate.value, {})
      : undefined,
  );
  const currentPage = computed(() =>
    catalog.find((p) => p.id === routeId.value),
  );
  const viewPage = computed(() => groupedPage.value ?? currentPage.value);

  const headingTitle = computed(() =>
    routeMode.value === 'badge'
      ? resolveStringVariables(
          definitions.value?.nodes[currentPage.value?.badgeNodeHash ?? '']
            ?.displayProperties.name ||
            currentPage.value?.name ||
            '',
        )
      : routeMode.value === 'seal'
        ? (selected.value?.title ?? viewPage.value?.name)
        : currentPage.value?.id === 'monument_of_triumph'
          ? 'Monument of Triumph'
          : viewPage.value?.name,
  );
  const headingKind = computed(() =>
    currentPage.value?.category === 'Other' && !currentPage.value?.sealNodeHash
      ? undefined
      : routeMode.value === 'badge'
        ? 'badge'
        : routeMode.value === 'seal' && currentPage.value?.sealNodeHash
          ? 'seal'
          : routeMode.value === 'triumphs'
            ? 'triumphs'
            : undefined,
  );
  const activeTriumphsOnly = computed(
    () =>
      routeMode.value === 'triumphs' &&
      !currentPage.value?.parentPageId &&
      !selected.value?.legacy &&
      pageEditions.value.some(
        (page) => page.parentPageId && sealsById.value[page.id]?.legacy,
      ),
  );
  const viewDescription = computed(() =>
    (currentPage.value?.category === 'Other' &&
      !currentPage.value?.sealNodeHash) ||
    routeMode.value === 'seal' ||
    routeMode.value === 'badge'
      ? selected.value?.description
      : '',
  );
  const breadcrumb = computed(() => {
    const page = viewPage.value;
    if (!page) return '';
    const category =
      catalogGroups.find((group) => group.category === page.category)?.name ??
      page.category;
    const view =
      currentPage.value?.tabLabel ??
      {
        seal: 'Seal requirements',
        badge: 'Collection badge',
        raid:
          viewPage.value?.category === 'Dungeons'
            ? 'Full dungeon'
            : 'Full raid',
        triumphs: 'All triumphs',
      }[routeMode.value];
    return `${category} / ${page.name} / ${view}`;
  });
  const viewLabel = computed(
    () =>
      ({
        'Raid seals': 'Raid view',
        Activities: 'Activity view',
        Expansions: 'Expansion view',
        Destinations: 'Destination view',
        Events: 'Event view',
        Other: 'View',
        'Other badges': 'Badge view',
        'Other seals': 'Seal view',
        Dungeons: 'Dungeon view',
        'Exotic missions': 'Exotic mission view',
      })[viewPage.value?.category ?? ''] ?? 'Seasonal view',
  );
  const viewTabs = computed(() => {
    const page = viewPage.value;
    if (!page) return [];
    if (page.category === 'Other badges')
      return [{ href: `#/badge/${page.id}`, label: 'Badge', active: true }];
    const modes: PageMode[] = [
      ...(page.sealNodeHash ? ['seal' as const] : []),
      ...(page.badgeNodeHash ? ['badge' as const] : []),
      ...(['Raid seals', 'Dungeons'].includes(page.category) &&
      page.sealNodeHash
        ? ['raid' as const]
        : hasDuplicateTriumphs(page)
          ? []
          : ['triumphs' as const]),
    ];
    return [
      ...modes.map((mode) => ({
        href: `#/${mode}/${page.id}`,
        label:
          mode === 'seal' && page.tabLabel && pageEditions.value.length > 1
            ? page.tabLabel
            : page.id === 'monument_of_triumph' && mode === 'triumphs'
              ? 'Monument triumphs'
              : page.tabLabel && !page.sealNodeHash
                ? page.tabLabel
                : mode === 'seal'
                  ? 'Seal'
                  : mode === 'badge'
                    ? 'Badge'
                    : mode === 'raid'
                      ? page.category === 'Dungeons'
                        ? 'Full dungeon'
                        : 'Full raid'
                      : 'All triumphs',
        active: routeId.value === page.id && routeMode.value === mode,
      })),
      ...pageEditions.value
        .filter((tab) => tab.parentPageId)
        .map((tab) => ({
          href: `#/${tab.sealNodeHash ? 'seal' : 'triumphs'}/${tab.id}`,
          label: tab.tabLabel!,
          active: routeId.value === tab.id,
        })),
    ];
  });
  const metricView = computed(
    () =>
      !!selected.value?.headings.length &&
      selected.value.headings.every(
        (h) => h.metric && h.metric !== 'gildingCount' && h.metric !== 'gilded',
      ),
  );
  const collectionView = computed(
    () =>
      routeMode.value === 'badge' ||
      (!!selected.value?.headings.length &&
        !metricView.value &&
        selected.value.headings.every(
          (h) => h.collectibleHashes || h.checklist || h.metric,
        )),
  );
  const summaryLabel = computed(() =>
    collectionView.value
      ? 'Collected'
      : routeMode.value === 'seal'
        ? 'Requirements'
        : 'Completion',
  );
  return {
    isMembers,
    routeMode,
    routeId,
    groupedPage,
    isHome,
    seals,
    sealsById,
    pageMode,
    selectedTemplate,
    selected,
    currentPage,
    headingTitle,
    headingKind,
    activeTriumphsOnly,
    viewDescription,
    breadcrumb,
    viewLabel,
    viewTabs,
    metricView,
    collectionView,
    summaryLabel,
  };
}
