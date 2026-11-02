import type { Heading } from './types';

// Display filtering must not alter progress calculations or the full tooltip details.
export function displayObjectives<T extends { hash: string | number }>(heading: Heading, objectives: T[]): T[] {
  return heading.hiddenObjectiveHashes?.length
    ? objectives.filter(objective => !heading.hiddenObjectiveHashes!.includes(String(objective.hash)))
    : objectives;
}
