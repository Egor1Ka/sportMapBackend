// ── Example Provider ────────────────────────────────────────────────────────
// Providers wrap external API integrations (Stripe, SendGrid, Twilio, etc.).
// Each provider exports functions for a specific external service.
// Copy this file and replace with your actual external API calls.
//
// Pattern:
//   1. Define API URLs and read env vars at module level
//   2. Create pure functions for building requests
//   3. Create async functions for API calls
//   4. Export a clean interface
//
// Example: a hypothetical notification service

// const { NOTIFY_API_KEY, NOTIFY_BASE_URL } = process.env;
//
// const buildHeaders = () => ({
//   Authorization: `Bearer ${NOTIFY_API_KEY}`,
//   "Content-Type": "application/json",
// });
//
// const sendNotification = async (userId, message) => {
//   const response = await fetch(`${NOTIFY_BASE_URL}/send`, {
//     method: "POST",
//     headers: buildHeaders(),
//     body: JSON.stringify({ userId, message }),
//   });
//   return response.json();
// };
//
// export { sendNotification };

export {};
