import { expect, it } from 'vitest';
import { composeClanEmblem, type ClanBannerData, type ClanBannerSource } from '../src/clanBanner';
const rgba = (red: number, alpha = 255) => ({ red, green: 20, blue: 30, alpha });
export const banner: ClanBannerData = { decalId: 1, decalColorId: 2, decalBackgroundColorId: 3, gonfalonId: 4, gonfalonColorId: 5, gonfalonDetailId: 6, gonfalonDetailColorId: 7 };
export const source: ClanBannerSource = {
  clanBannerDecalsSquare: { '1': { foregroundPath: '/common/destiny2_content/icons/banner-front.png', backgroundPath: '/common/destiny2_content/icons/banner-back.png' } },
  clanBannerGonfalonDetailsSquare: { '6': '/common/destiny2_content/icons/banner-detail.png' },
  clanBannerGonfalonColors: { '5': rgba(10) }, clanBannerDecalPrimaryColors: { '2': rgba(200) },
  clanBannerDecalSecondaryColors: { '3': rgba(240) }, clanBannerGonfalonDetailColors: { '7': rgba(50, 0) },
};
it('composes square banner layers in paint order with their selected colors', () => {
  expect(composeClanEmblem(banner, source)).toEqual({ backgroundColor: 'rgba(10, 20, 30, 1)', layers: [
    { path: '/common/destiny2_content/icons/banner-detail.png', color: 'rgba(50, 20, 30, 0)' },
    { path: '/common/destiny2_content/icons/banner-back.png', color: 'rgba(240, 20, 30, 1)' },
    { path: '/common/destiny2_content/icons/banner-front.png', color: 'rgba(200, 20, 30, 1)' },
  ] });
});
it('falls back when banner definitions or colors are missing or invalid', () => {
  expect(composeClanEmblem({ ...banner, decalId: 999 }, source)).toBeUndefined();
  expect(composeClanEmblem(banner, { ...source, clanBannerGonfalonColors: { '5': rgba(300) } })).toBeUndefined();
  expect(composeClanEmblem(banner, { ...source, clanBannerGonfalonDetailsSquare: { '6': 'https://example.com/foreign.png' } })).toBeUndefined();
});
