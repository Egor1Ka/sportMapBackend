/**
 * @param {import('mongoose').Document} doc
 * @returns {{ id: string, code: string, label: string, icon: string | null, color: string | null, order: number }}
 */
export function toDTO(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    code: doc.code,
    label: doc.label,
    icon: doc.icon ?? null,
    color: doc.color ?? null,
    order: doc.order ?? 0,
  };
}
