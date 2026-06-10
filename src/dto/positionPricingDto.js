import { resolveCurrency } from "../services/currencyResolver.js";

const toPositionPricingDto = async (doc) => {
  const currency = await resolveCurrency({ orgId: doc.orgId });
  return {
    id: doc._id.toString(),
    eventTypeId: doc.eventTypeId.toString(),
    positionId: doc.positionId.toString(),
    price: {
      amount: doc.price.amount,
      currency,
    },
  };
};

export { toPositionPricingDto };
