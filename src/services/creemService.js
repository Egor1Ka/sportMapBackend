import { Creem } from 'creem';
import { getProduct } from '../products/registry.js';

const CREEM_SECRET_KEY = process.env.CREEM_SECRET_KEY;
const CREEM_SERVER_IDX = process.env.CREEM_SERVER_IDX != null ? Number(process.env.CREEM_SERVER_IDX) : 0;

const createCreemClient = () =>
  new Creem({
    apiKey: CREEM_SECRET_KEY,
    serverIdx: CREEM_SERVER_IDX,
  });

function getCreemClient() {
  if (!CREEM_SECRET_KEY) {
    throw new Error('CREEM_SECRET_KEY is not configured');
  }
  return createCreemClient();
}

/**
 * Create a Creem checkout session and return the checkout URL.
 * @param {{
 *   userId: string,
 *   productCode: string,
 *   planCode: string,
 *   userEmail: string | null,
 *   successUrl: string,
 *   cancelUrl?: string
 * }} params
 * @returns {Promise<{ checkout_url: string }>}
 */
export async function createCheckoutSession(params) {
  const { userId, productCode, planCode, userEmail, successUrl } = params;

  const product = getProduct(productCode);
  if (!product) {
    throw new Error(`Unknown product: ${productCode}`);
  }
  const creemProductId = await product.getCreemProductId(planCode);
  if (!creemProductId) {
    throw new Error(`creemProductId not found for product "${productCode}" plan "${planCode}"`);
  }

  const creem = getCreemClient();
  const checkout = await creem.checkouts.create({
    productId: creemProductId,
    successUrl,
    customer: userEmail ? { email: userEmail } : undefined,
    metadata: {
      userId: String(userId),
      productCode: String(productCode),
      planCode: String(planCode),
    },
  });

  const checkoutUrl = checkout.checkoutUrl;
  if (!checkoutUrl) {
    throw new Error('Creem response missing checkout URL');
  }
  return { checkout_url: checkoutUrl };
}
