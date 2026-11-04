export const age = (time?: number) => {
  if (!time) return 'Not cached';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  return minutes < 1
    ? 'just now'
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
};
export const bungieUrl = (path: string) => `https://www.bungie.net${path}`;
/** CSS mask for a Bungie icon. Only manifest icon paths are placed in the stylesheet value. */
export const iconMask = (icon?: string) =>
  icon && /^\/common\/destiny2_content\/icons\/[\w./-]+$/.test(icon)
    ? `url("${bungieUrl(icon)}")`
    : undefined;
