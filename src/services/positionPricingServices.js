import {
  findByEventType,
  findByEventTypeAndPosition,
  upsertPricing,
  deletePricing,
} from "../repository/positionPricingRepository.js";
import { getEventTypeById } from "../repository/eventTypeRepository.js";
import { toPositionPricingDto } from "../dto/positionPricingDto.js";
import { HttpError } from "../shared/utils/http/httpError.js";
import { generalStatus } from "../shared/utils/http/httpStatus.js";

const getPricing = async (eventTypeId) => {
  const docs = await findByEventType(eventTypeId);
  return Promise.all(docs.map(toPositionPricingDto));
};

// Синхронизация: принимает массив overrides и приводит БД к этому состоянию
// overrides: [{ positionId, amount }]
const syncPricing = async (eventTypeId, overrides) => {
  const eventType = await getEventTypeById(eventTypeId);
  if (!eventType) return null;
  if (!eventType.orgId) {
    throw new HttpError({ ...generalStatus.BAD_REQUEST, message: "personal event types do not support position pricing" });
  }

  const processOverride = async (o) => {
    if (o.amount === null || o.amount === undefined || o.amount === "") {
      await deletePricing(eventTypeId, o.positionId);
      return null;
    }
    return upsertPricing({
      orgId: eventType.orgId,
      eventTypeId,
      positionId: o.positionId,
      price: { amount: Number(o.amount) },
    });
  };

  await Promise.all(overrides.map(processOverride));

  return getPricing(eventTypeId);
};

const resolvePriceForStaff = async (eventType, staffPositionId) => {
  if (!staffPositionId) {
    return { amount: eventType.price ? eventType.price.amount : 0 };
  }

  const override = await findByEventTypeAndPosition(eventType.id, staffPositionId);
  if (!override) {
    return { amount: eventType.price ? eventType.price.amount : 0 };
  }

  return { amount: override.price.amount };
};

export { getPricing, syncPricing, resolvePriceForStaff };
