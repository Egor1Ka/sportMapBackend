import mongoose from 'mongoose';

/**
 * @param {import('mongoose').Document} doc
 * @returns {{ id: string, userId: string, timestamp: string, source: string, shots_made: number, shots_total: number, accuracy: number, zones: Record<string, { attempts: number, makes: number, accuracy_pct: number }> }}
 */
export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    userId: doc.userId?.toString?.() ?? doc.userId,
    timestamp: doc.timestamp instanceof Date ? doc.timestamp.toISOString() : new Date(doc.timestamp).toISOString(),
    source: doc.source,
    shots_made: doc.shots_made,
    shots_total: doc.shots_total,
    accuracy: doc.accuracy,
    zones: doc.zones && typeof doc.zones === 'object' ? { ...doc.zones } : {},
  };
}

/**
 * @param {{ userId?: string, timestamp?: string | number | Date, source?: string, shots_made?: number, shots_total?: number, accuracy?: number, zones?: Record<string, unknown> }} dto
 * @returns {Record<string, unknown>}
 */
export function toEntity(dto) {
  const entity = {};
  if (dto.userId != null) entity.userId = new mongoose.Types.ObjectId(dto.userId);
  if (dto.timestamp != null) entity.timestamp = dto.timestamp;
  if (dto.source != null) entity.source = dto.source;
  if (dto.shots_made != null) entity.shots_made = dto.shots_made;
  if (dto.shots_total != null) entity.shots_total = dto.shots_total;
  if (dto.accuracy != null) entity.accuracy = dto.accuracy;
  if (dto.zones != null && typeof dto.zones === 'object') entity.zones = dto.zones;
  return entity;
}
