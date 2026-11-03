import { buildSealOverview } from './sealOverview';
import type {
  Cell,
  Definitions,
  Heading,
  PageConfig,
  Profile,
  Seal,
} from './types';

const baseHeading = (
  hash: string,
  name: string,
  description = '',
): Heading => ({
  hash,
  name,
  label: name,
  description,
  scope: 0,
  gilding: false,
  skip: false,
  order: 0,
  objectives: [],
  intervals: [],
});
export function buildOtherPage(
  page: PageConfig,
  defs: Definitions,
): Seal | undefined {
  if (!page.kind && !page.checklistHash) return;
  if (page.kind === 'seals') return buildSealOverview(page, defs);
  const base: Seal = {
    page,
    title: page.name,
    description: '',
    completionHash: '',
    headings: [],
  };
  if (page.kind === 'ranks') {
    base.description =
      'Current, renewed, and lifetime-highest Guardian Ranks. Bungie does not expose a season-by-season rank history in the profile response.';
    for (const [key, name, description] of [
      [
        'currentGuardianRank',
        'Current',
        'The Guardian Rank currently displayed for this guardian.',
      ],
      [
        'renewedGuardianRank',
        'Renewed',
        'The renewed Guardian Rank reported by Bungie; this can differ from the displayed rank.',
      ],
      [
        'lifetimeHighestGuardianRank',
        'Lifetime highest',
        'The highest Guardian Rank this guardian has reached.',
      ],
    ])
      base.headings.push({
        ...baseHeading('rank:' + key, name!, description),
        metric: 'guardianRank',
        metricKey: key,
        skip: true,
        group: 'Guardian Ranks',
      });
  } else if (page.kind === 'commendations') {
    if (!defs.commendationNodes || !Object.keys(defs.commendationNodes).length)
      return {
        ...base,
        unavailable: 'Commendation definitions are unavailable.',
      };
    base.description =
      'Commendations are activity-specific cards given to fellow guardians. Total score includes retained score from past seasons. Category scores are shown separately from the current season’s individual cards and given/received counts.';
    const metric = (
      key: string,
      name: string,
      description: string,
      group: string,
      color?: string,
    ) => ({
      ...baseHeading('commendation:' + key, name, description),
      metric: 'commendation' as const,
      metricKey: key,
      skip: true,
      group,
      color,
    });
    base.headings.push(
      metric(
        'total',
        'Total score',
        'Total commendation score across seasons, including retained score.',
        'Score',
      ),
      metric(
        'given',
        'Given',
        'Commendations given this season.',
        'Current details',
      ),
      metric(
        'received',
        'Received',
        'Commendations received this season.',
        'Current details',
      ),
    );
    const root = defs.commendationNodes['1062358355'];
    for (const hash of root?.childCommendationNodeHashes ?? []) {
      const node = defs.commendationNodes[String(hash)];
      if (!node) continue;
      const color = node.color
        ? `rgb(${node.color.red} ${node.color.green} ${node.color.blue})`
        : undefined;
      base.headings.push(
        metric(
          'node:' + hash,
          node.displayProperties.name,
          [
            node.displayProperties.description,
            'Aggregate category score, rather than an individual card count.',
          ]
            .filter(Boolean)
            .join('\n'),
          node.displayProperties.name,
          color,
        ),
      );
      const hashes = new Set([
        ...(node.childCommendationHashes ?? []).map(String),
        ...Object.values(defs.commendations ?? {})
          .filter((c) => c.parentCommendationNodeHash === hash)
          .map((c) => String(c.hash)),
      ]);
      for (const cardHash of hashes) {
        const card = defs.commendations?.[cardHash];
        if (!card) continue;
        const activities = card.displayActivities
          ?.map((a) => a.name)
          .filter(Boolean)
          .join(', ');
        base.headings.push(
          metric(
            'card:' + cardHash,
            card.displayProperties.name,
            [
              card.displayProperties.description,
              activities ? `Activities: ${activities}.` : '',
            ]
              .filter(Boolean)
              .join('\n'),
            node.displayProperties.name,
            color,
          ),
        );
      }
    }
  } else {
    const checklist = defs.checklists?.[page.checklistHash!];
    if (!checklist?.entries.length)
      return {
        ...base,
        unavailable: 'This checklist is unavailable in the current manifest.',
      };
    base.description = checklist.displayProperties.description ?? '';
    if (checklist.scope === 1)
      base.description +=
        ' Progress uses the most complete character checklist; entries are not combined across characters.';
    base.headings = checklist.entries.map((entry, i) => ({
      ...baseHeading(
        `checklist:${checklist.hash}:${entry.hash}`,
        entry.displayProperties.name || `Entry ${i + 1}`,
        entry.displayProperties.description,
      ),
      scope: entry.scope ?? checklist.scope,
      checklist: {
        hash: String(checklist.hash),
        entryHash: String(entry.hash),
      },
      group: 'Checklist',
    }));
  }
  return base;
}
export function otherCell(
  profile: Profile | undefined,
  heading: Heading,
  headings: Heading[],
): Cell | undefined {
  const empty = (
    text: string,
    missing: boolean,
    detail: string,
    complete = false,
  ): Cell => ({
    text,
    missing,
    detail,
    complete,
    fraction: complete ? 1 : 0,
    objectives: [],
    unowned: false,
  });
  if (heading.metric === 'guardianRank' || heading.metric === 'commendation') {
    let value: number | undefined,
      detail = '';
    if (heading.metric === 'guardianRank') {
      const key = heading.metricKey as
        | 'currentGuardianRank'
        | 'renewedGuardianRank'
        | 'lifetimeHighestGuardianRank';
      value = profile?.profile?.data?.[key];
      detail =
        value === undefined
          ? 'Rank unavailable.'
          : `${heading.label}: ${value}`;
    } else {
      const data = profile?.profileCommendations?.data,
        key = heading.metricKey ?? '';
      value =
        key === 'total'
          ? data?.totalScore
          : key === 'given'
            ? data?.scoreDetailValues?.[0]
            : key === 'received'
              ? data?.scoreDetailValues?.[1]
              : key.startsWith('node:')
                ? data?.commendationNodeScoresByHash?.[key.slice(5)]
                : data?.commendationScoresByHash?.[key.slice(5)];
      const percentage = key.startsWith('node:')
        ? data?.commendationNodePercentagesByHash?.[key.slice(5)]
        : undefined;
      detail =
        value === undefined
          ? 'Commendation data unavailable.'
          : `${heading.label}: ${value}${percentage !== undefined ? ` · ${percentage}%` : ''}`;
    }
    const missing = typeof value !== 'number' || !Number.isFinite(value);
    return empty(missing ? '—' : String(value), missing, detail);
  }
  if (!heading.checklist) return;
  const { hash, entryHash } = heading.checklist;
  let entries = profile?.profileProgression?.data?.checklists?.[hash];
  if (heading.scope === 1) {
    const candidates = Object.values(profile?.characterProgressions?.data ?? {})
      .map((c) => c.checklists?.[hash])
      .filter((c): c is Record<string, boolean> => !!c);
    const hashes = headings
      .filter((h) => h.checklist?.hash === hash)
      .map((h) => h.checklist!.entryHash);
    entries = candidates.reduce<Record<string, boolean> | undefined>(
      (best, next) =>
        !best ||
        hashes.filter((h) => next[h]).length >
          hashes.filter((h) => best[h]).length
          ? next
          : best,
      undefined,
    );
  }
  const value = entries?.[entryHash],
    missing = typeof value !== 'boolean';
  return empty(
    missing ? '—' : value ? '✓' : '·',
    missing,
    missing
      ? 'Checklist entry unavailable.'
      : value
        ? 'Collected'
        : 'Not collected',
    value === true,
  );
}
