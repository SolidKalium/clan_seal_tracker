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
