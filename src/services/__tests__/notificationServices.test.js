import { describe, it, before, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

const membershipRepoPath = "../../repository/membershipRepository.js";

const state = { adminIds: [] };
const getOrgAdminUserIds = async () => state.adminIds;

const calls = { sent: [] };
const sendBehavior = { impl: async () => "msg-default" };
const userBehavior = { find: async () => [], findById: async () => null };
const orgBehavior = { findById: async () => null };

describe("collectRecipientUserIds", () => {
  const ctx = { collectRecipientUserIds: null };

  before(async () => {
    mock.module(membershipRepoPath, {
      namedExports: { getOrgAdminUserIds },
    });
    mock.module("../../repository/notificationRepository.js", {
      namedExports: {
        createNotification: async (data) => ({ _id: "n1", ...data }),
        createManyNotifications: async () => [],
        skipScheduledByBooking: async () => [],
      },
    });
    mock.module("../../providers/telegramProvider.js", {
      namedExports: {
        sendMessage: async (chatId, text) => {
          calls.sent.push({ chatId, text });
          return sendBehavior.impl(chatId, text);
        },
        initBot: () => {},
        getBot: () => null,
      },
    });
    mock.module("../../modules/user/model/User.js", {
      defaultExport: {
        find: (...args) => userBehavior.find(...args),
        findById: (...args) => userBehavior.findById(...args),
      },
    });
    mock.module("../../models/Organization.js", {
      defaultExport: {
        findById: (...args) => orgBehavior.findById(...args),
      },
    });
    ({ collectRecipientUserIds: ctx.collectRecipientUserIds } = await import("../notificationServices.js"));
  });

  afterEach(() => {
    state.adminIds = [];
  });

  it("returns only lead host when org has no admins", async () => {
    state.adminIds = [];
    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await ctx.collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String), ["u-lead"]);
  });

  it("returns lead host + admins (no overlap)", async () => {
    state.adminIds = ["u-owner", "u-admin"];
    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await ctx.collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String).sort(), ["u-admin", "u-lead", "u-owner"]);
  });

  it("dedupes when lead host is also owner of the org", async () => {
    state.adminIds = ["u-lead", "u-admin"];
    const booking = {
      orgId: "org1",
      hosts: [{ userId: "u-lead", role: "lead" }],
    };
    const result = await ctx.collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String).sort(), ["u-admin", "u-lead"]);
  });

  it("returns admins only when no lead host exists", async () => {
    state.adminIds = ["u-admin"];
    const booking = { orgId: "org1", hosts: [] };
    const result = await ctx.collectRecipientUserIds(booking);
    assert.deepEqual(result.map(String), ["u-admin"]);
  });
});

describe("sendBookingTelegramToUser", () => {
  const ctx = { sendBookingTelegramToUser: null };

  before(async () => {
    const mod = await import("../notificationServices.js");
    ctx.sendBookingTelegramToUser = mod.sendBookingTelegramToUser;
  });

  beforeEach(() => {
    calls.sent = [];
    sendBehavior.impl = async () => "msg-default";
  });

  it("creates SENT notification when sendMessage returns id", async () => {
    sendBehavior.impl = async () => "msg-42";
    const booking = { _id: "b1", orgId: "o1", startAt: new Date("2026-04-20T10:00:00Z"), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await ctx.sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(calls.sent.length, 1);
    assert.equal(calls.sent[0].chatId, "chat-1");
    assert.equal(result.status, "sent");
    assert.equal(result.externalId, "msg-42");
    assert.equal(String(result.recipientId), "u1");
  });

  it("creates SKIPPED notification when sendMessage returns null", async () => {
    sendBehavior.impl = async () => null;
    const booking = { _id: "b1", orgId: "o1", startAt: new Date(), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await ctx.sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(result.status, "skipped");
  });

  it("creates FAILED notification when sendMessage throws", async () => {
    sendBehavior.impl = async () => { throw new Error("network down"); };
    const booking = { _id: "b1", orgId: "o1", startAt: new Date(), hosts: [], inviteeSnapshot: {} };
    const user = { _id: "u1", name: "Alice", telegramChatId: "chat-1" };
    const result = await ctx.sendBookingTelegramToUser(booking, "booking_confirmed", user, "Bob");

    assert.equal(result.status, "failed");
    assert.equal(result.attempts, 1);
  });
});

describe("sendBookingTelegramNotifications", () => {
  const ctx = { sendBookingTelegramNotifications: null };

  before(async () => {
    const mod = await import("../notificationServices.js");
    ctx.sendBookingTelegramNotifications = mod.sendBookingTelegramNotifications;
  });

  beforeEach(() => {
    calls.sent = [];
    sendBehavior.impl = async () => "msg-default";
    orgBehavior.findById = async () => null;
  });

  it("sends to lead host + admins, deduped, with org name in text", async () => {
    state.adminIds = ["u-owner", "u-admin"];
    orgBehavior.findById = async () => ({ name: "Acme", timezone: "Europe/Kyiv" });
    const users = [
      { _id: "u-lead",  name: "Lead",  telegramChatId: "chat-lead" },
      { _id: "u-owner", name: "Owner", telegramChatId: "chat-owner" },
      { _id: "u-admin", name: "Admin", telegramChatId: "chat-admin" },
    ];
    userBehavior.find = async (query) => {
      const ids = query._id.$in.map(String);
      const matches = (u) => ids.includes(String(u._id)) && !!u.telegramChatId;
      return users.filter(matches);
    };
    userBehavior.findById = async (id) => users.find((u) => String(u._id) === String(id)) || null;

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date("2026-04-15T12:00:00Z"),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    await ctx.sendBookingTelegramNotifications(booking, "booking_confirmed");

    const chats = calls.sent.map((m) => m.chatId).sort();
    assert.deepEqual(chats, ["chat-admin", "chat-lead", "chat-owner"]);
    assert.ok(calls.sent.every((m) => m.text.includes("🏢 Acme")), "org name must appear in every message");
    assert.ok(calls.sent.every((m) => m.text.includes("15.04.2026 15:00")), "time must be formatted in Kyiv timezone (UTC+3)");
  });

  it("skips users without telegramChatId", async () => {
    state.adminIds = ["u-owner"];
    const users = [
      { _id: "u-lead",  name: "Lead",  telegramChatId: "chat-lead" },
      { _id: "u-owner", name: "Owner", telegramChatId: null },
    ];
    userBehavior.find = async (query) => {
      const ids = query._id.$in.map(String);
      const matches = (u) => ids.includes(String(u._id)) && !!u.telegramChatId;
      return users.filter(matches);
    };
    userBehavior.findById = async (id) => users.find((u) => String(u._id) === String(id)) || null;

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date(),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    await ctx.sendBookingTelegramNotifications(booking, "booking_confirmed");

    assert.deepEqual(calls.sent.map((m) => m.chatId), ["chat-lead"]);
  });

  it("does nothing when no recipients have telegramChatId", async () => {
    state.adminIds = [];
    userBehavior.find = async () => [];
    userBehavior.findById = async () => null;

    const booking = {
      _id: "b1", orgId: "o1", startAt: new Date(),
      hosts: [{ userId: "u-lead", role: "lead" }],
      inviteeSnapshot: {},
    };

    const result = await ctx.sendBookingTelegramNotifications(booking, "booking_confirmed");

    assert.deepEqual(calls.sent, []);
    assert.deepEqual(result, []);
  });
});
