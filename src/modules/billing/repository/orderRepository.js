import Order from "../model/Order.js";
import { orderToDTO } from "../dto/billingDto.js";

const createOrder = async (data) => {
  const doc = await Order.create(data);
  return orderToDTO(doc);
};

const getOrdersByUserId = async (userId) => {
  const docs = await Order.find({ userId }).sort({ createdAt: -1 });
  return docs.map(orderToDTO);
};

export { createOrder, getOrdersByUserId };
