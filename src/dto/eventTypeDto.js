import { getOgImageUrl, ASSET_TYPES } from "../modules/media/index.js";
import { resolveCurrency } from "../services/currencyResolver.js";

const toPriceDto = (price, currency) => ({
  amount: price.amount,
  currency,
});

const toEventTypeDto = async (doc) => {
  const id = doc._id.toString();
  const currency = await resolveCurrency({
    orgId: doc.orgId,
    userId: doc.userId,
  });
  return {
    id,
    userId: doc.userId ? doc.userId.toString() : null,
    orgId: doc.orgId ? doc.orgId.toString() : null,
    slug: doc.slug,
    name: doc.name,
    image: doc.image || "",
    ogImage: doc.image ? getOgImageUrl(ASSET_TYPES.SERVICE_PHOTO, id) : null,
    durationMin: doc.durationMin,
    type: doc.type,
    color: doc.color,
    description: doc.description || null,
    price: doc.price ? toPriceDto(doc.price, currency) : null,
    bufferAfter: doc.bufferAfter,
    minNotice: doc.minNotice,
    slotStepMin: doc.slotStepMin,
    active: doc.active,
    staffPolicy: doc.staffPolicy,
    assignedPositions: doc.assignedPositions
      ? doc.assignedPositions.map((id) => id.toString())
      : [],
    assignedStaff: doc.assignedStaff
      ? doc.assignedStaff.map((id) => id.toString())
      : [],
  };
};

export { toEventTypeDto };
