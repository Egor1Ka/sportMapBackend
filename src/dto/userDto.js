import mongoose from 'mongoose';

/**
 * @param {import('mongoose').Document} doc
 * @returns {{ id: string, name: string, email: string, avatar: string | null, role?: string }}
 */
export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar ?? null,
    ...(doc.role && { role: doc.role }),
  };
}

/**
 * @param {{ id?: string, name?: string, email?: string, avatar?: string | null }} dto
 * @returns {{ _id?: mongoose.Types.ObjectId, name?: string, email?: string, avatar?: string | null }}
 */
export function toEntity(dto) {
  const entity = {};
  if (dto.id != null) entity._id = new mongoose.Types.ObjectId(dto.id);
  if (dto.name != null) entity.name = dto.name;
  if (dto.email != null) entity.email = dto.email;
  if (dto.avatar !== undefined) entity.avatar = dto.avatar;
  return entity;
}
