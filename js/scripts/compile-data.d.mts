import type { PageConfig } from '../src/types';
export function readJsonc(text: string, name: string): unknown;
export function compile(settings: Record<string, unknown>, pages: unknown): {
  config: { apiKey: string; clanId: string; language: string };
  catalog: PageConfig[];
};
