export interface ClanBannerData {
  decalId: number;
  decalColorId: number;
  decalBackgroundColorId: number;
  gonfalonId: number;
  gonfalonColorId: number;
  gonfalonDetailId: number;
  gonfalonDetailColorId: number;
}
interface BannerColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}
export interface ClanBannerSource {
  clanBannerDecalsSquare: Record<
    string,
    { foregroundPath: string; backgroundPath: string }
  >;
  clanBannerGonfalonDetailsSquare: Record<string, string>;
  clanBannerGonfalonColors: Record<string, BannerColor>;
  clanBannerDecalPrimaryColors: Record<string, BannerColor>;
  clanBannerDecalSecondaryColors: Record<string, BannerColor>;
  clanBannerGonfalonDetailColors: Record<string, BannerColor>;
}
export interface ClanEmblemData {
  backgroundColor: string;
  layers: { path: string; color: string }[];
}
const color = (c: BannerColor | undefined) =>
  c &&
  [c.red, c.green, c.blue, c.alpha].every(
    (n) => Number.isFinite(n) && n >= 0 && n <= 255,
  )
    ? `rgba(${c.red}, ${c.green}, ${c.blue}, ${c.alpha / 255})`
    : undefined;
export function composeClanEmblem(
  banner: ClanBannerData,
  source: ClanBannerSource,
): ClanEmblemData | undefined {
  const decal = source.clanBannerDecalsSquare?.[banner.decalId];
  const backgroundColor = color(
    source.clanBannerGonfalonColors?.[banner.gonfalonColorId],
  );
  const layers = [
    {
      path: source.clanBannerGonfalonDetailsSquare?.[banner.gonfalonDetailId],
      color: color(
        source.clanBannerGonfalonDetailColors?.[banner.gonfalonDetailColorId],
      ),
    },
    {
      path: decal?.backgroundPath,
      color: color(
        source.clanBannerDecalSecondaryColors?.[banner.decalBackgroundColorId],
      ),
    },
    {
      path: decal?.foregroundPath,
      color: color(source.clanBannerDecalPrimaryColors?.[banner.decalColorId]),
    },
  ];
  if (
    !backgroundColor ||
    layers.some(
      (l) =>
        !l.color ||
        !l.path ||
        !/^\/common\/destiny2_content\/icons\/[\w.-]+\.png$/.test(l.path),
    )
  )
    return undefined;
  return { backgroundColor, layers: layers as ClanEmblemData['layers'] };
}
