import { subscriptionProduct } from "./subscription/index.js";

const PRODUCTS = {
  subscription: subscriptionProduct,
};

export const getProduct = (productCode) => PRODUCTS[productCode] ?? null;
