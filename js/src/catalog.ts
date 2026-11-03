import catalogJson from '../.generated/catalog.json';
import type { PageConfig } from './types';

export const catalog = catalogJson as PageConfig[];
export const catalogGroups = [
  { name: 'Raids', title: 'Raid seals', kind: 'Raid', category: 'Raid seals' },
  {
    name: 'Dungeons',
    title: 'Dungeons',
    kind: 'Dungeon',
    category: 'Dungeons',
  },
  {
    name: 'Exotic missions',
    title: 'Exotic missions',
    kind: 'Exotic mission',
    category: 'Exotic missions',
  },
  {
    name: 'Activities',
    title: 'Activity seals',
    kind: 'Activity',
    category: 'Activities',
  },
  {
    name: 'Expansions',
    title: 'Expansion seals',
    kind: 'Expansion',
    category: 'Expansions',
  },
  {
    name: 'Destinations',
    title: 'Destinations',
    kind: 'Destination',
    category: 'Destinations',
  },
  { name: 'Events', title: 'Events', kind: 'Event', category: 'Events' },
  {
    name: 'Seasons & Episodes',
    title: 'Seasons & Episodes',
    kind: 'Release',
    category: 'Seasons & Episodes',
  },
  {
    name: 'Other badges',
    title: 'Other badges',
    kind: 'Badge',
    category: 'Other badges',
  },
  {
    name: 'Other seals',
    title: 'Other seals',
    kind: 'Seal',
    category: 'Other seals',
  },
  { name: 'Other', title: 'Other', kind: 'Other', category: 'Other' },
].map((group, index) => ({
  ...group,
  id: `sidebar-section-${index}`,
  pages: catalog.filter(
    (p) => p.category === group.category && !p.parentPageId,
  ),
}));
