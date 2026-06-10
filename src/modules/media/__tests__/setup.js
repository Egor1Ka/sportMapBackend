import { loadEnvFile } from "node:process";
import mongoose from "mongoose";
import express from "express";
import { mock } from "node:test";

// ── Load test environment ────────────────────────────────────────────────────
try {
  loadEnvFile(".env.test");
} catch {
  throw new Error("Missing .env.test file. Copy .env.test.example to .env.test");
}

const uri = process.env.TEST_MONGODB_URI;
if (!uri) throw new Error("TEST_MONGODB_URI is required in .env.test");

// ── Environment variables ────────────────────────────────────────────────────
// Must be set before billing constants are imported (they read process.env at load time)
process.env.CREEM_PRODUCT_ORG_CREATOR = "test_product_org_creator";

// ── Mock the Creem provider ──────────────────────────────────────────────────
// Must be registered before billingController imports providers/creem.js.
// The real creem.js reads CREEM_WEBHOOK_SECRET at load time and would crash without it.
// We import the REAL normalizers from the shared module — no duplication.

import { EVENT_NORMALIZERS } from "../providers/normalizers.js";

const mockParseWebhookEvent = (rawBody, _signature) => {
  const event = JSON.parse(rawBody);
  const eventType = event.eventType || event.event_type;
  const eventData = event.object || event.data || event;
  const normalize = EVENT_NORMALIZERS[eventType];
  if (!normalize) return { eventType, data: eventData };
  return { eventType, data: normalize(eventData) };
};

const mockCancelSubscription = () => {
  throw new Error("cancelSubscription is not available in tests");
};

mock.module("../providers/creem.js", {
  defaultExport: {
    signatureHeader: "creem-signature",
    parseWebhookEvent: mockParseWebhookEvent,
    cancelSubscription: mockCancelSubscription,
  },
});

// ── App builder ──────────────────────────────────────────────────────────────

let app;
let server;

const startServer = async () => {
  await mongoose.connect(uri);

  // Import billing routes AFTER mock is registered and DB is connected
  const { billingRouter } = await import("../../billing/index.js");

  app = express();
  // CRITICAL: express.raw() MUST come before express.json() — matches production app.js:15-16
  app.use("/billing/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use("/billing", billingRouter);

  // Start server once for the entire test suite (avoids port churn and leaked servers)
  server = app.listen(0);

  return app;
};

const getBaseUrl = () => {
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
};

const closeServer = () =>
  new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

const stopServer = async () => {
  if (server) await closeServer();
  await mongoose.disconnect();
};

const clearCollections = async () => {
  const collections = mongoose.connection.collections;
  const clearCollection = ([, collection]) => collection.deleteMany({});
  await Promise.all(Object.entries(collections).map(clearCollection));
};

export { startServer, stopServer, clearCollections, getBaseUrl };
