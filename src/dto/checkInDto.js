const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

export function toCheckInResponse({ playgroundId, activeCount, viewer }) {
  return {
    playgroundId: playgroundId?.toString?.() ?? null,
    activeCount,
    viewer: viewer
      ? {
          isCheckedIn: viewer.isCheckedIn,
          expiresAt: toIso(viewer.expiresAt),
        }
      : { isCheckedIn: false, expiresAt: null },
  };
}
