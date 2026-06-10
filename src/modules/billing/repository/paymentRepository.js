import Payment from "../model/Payment.js";
import { paymentToDTO } from "../dto/billingDto.js";

const createPayment = async (data) => {
  const existing = await Payment.findOne({ providerEventId: data.providerEventId });
  if (existing) {
    const error = new Error(`Payment with providerEventId ${data.providerEventId} already exists`);
    error.code = 11000;
    throw error;
  }
  const doc = await Payment.create(data);
  return paymentToDTO(doc);
};

const getPaymentsByUserId = async (userId, limit = 50) => {
  const docs = await Payment.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
  return docs.map(paymentToDTO);
};

export { createPayment, getPaymentsByUserId };
