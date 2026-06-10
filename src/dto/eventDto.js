const isPopulated = (value) =>
  value && typeof value === 'object' && '_id' in value;

const toSportSummary = (sport) => {
  if (!isPopulated(sport)) return null;
  return {
    id: sport._id.toString(),
    code: sport.code ?? null,
    label: sport.label ?? sport.code ?? null,
    icon: sport.icon ?? null,
    color: sport.color ?? null,
  };
};

const toCreatorSummary = (creator) => {
  if (!isPopulated(creator)) {
    return { id: null, name: null, avatar: null };
  }
  return {
    id: creator._id.toString(),
    name: creator.name ?? null,
    avatar: creator.avatar ?? null,
  };
};

const toIso = (value) => (value instanceof Date ? value.toISOString() : null);

const isFinishedNow = (doc, now) =>
  doc.startAt instanceof Date &&
  doc.startAt.getTime() + (doc.durationMin ?? 60) * 60_000 <= now.getTime();

export function toDTO(doc, { rsvpCount = 0, viewer, now = new Date() } = {}) {
  if (!doc) return null;
  const effectiveStatus =
    doc.status === 'active' && isFinishedNow(doc, now) ? 'finished' : doc.status;
  const maxParticipants = doc.maxParticipants ?? null;
  const isFull = maxParticipants !== null && rsvpCount >= maxParticipants;
  const result = {
    id: doc._id.toString(),
    playgroundId: doc.playground?.toString?.() ?? null,
    sport: toSportSummary(doc.sport),
    creator: toCreatorSummary(doc.creator),
    startAt: toIso(doc.startAt),
    durationMin: doc.durationMin ?? 60,
    description: doc.description ?? null,
    maxParticipants,
    rsvpCount,
    isFull,
    status: effectiveStatus,
    createdAt: toIso(doc.createdAt),
  };
  if (viewer !== undefined && viewer !== null) {
    result.viewer = viewer;
  }
  return result;
}

export function toRsvpResponse({ rsvpCount, maxParticipants, isRsvped }) {
  const max = maxParticipants ?? null;
  return {
    rsvpCount,
    isFull: max !== null && rsvpCount >= max,
    viewer: { isRsvped },
  };
}
