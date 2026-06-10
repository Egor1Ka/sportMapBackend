import { test } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

// Cloudinary SDK не должен реально стучать в облако в тестах.
mock.module("cloudinary", {
  namedExports: {
    v2: {
      config: () => {},
      uploader: { upload_stream: () => {}, destroy: async () => {} },
      url: (publicId, options) => {
        const tr = options?.transformation;
        if (!tr) return `https://test/${publicId}`;
        const flat = (Array.isArray(tr) ? tr : [tr])
          .map((t) => Object.entries(t).map(([k, v]) => `${k[0]}_${v}`).join(","))
          .join("/");
        return `https://test/${flat}/${publicId}`;
      },
    },
  },
});

const provider = (await import("../providers/cloudinary.js")).default;

test("buildProviderId для user-avatar", () => {
  assert.strictEqual(
    provider.buildProviderId("user-avatar", "u1"),
    "slotix/avatars/users/u1",
  );
});

test("buildProviderId для staff-avatar", () => {
  assert.strictEqual(
    provider.buildProviderId("staff-avatar", "org1/u2"),
    "slotix/avatars/staff/org1/u2",
  );
});

test("buildProviderId для org-logo", () => {
  assert.strictEqual(
    provider.buildProviderId("org-logo", "org1"),
    "slotix/orgs/org1/logo",
  );
});

test("buildProviderId для service-photo", () => {
  assert.strictEqual(
    provider.buildProviderId("service-photo", "evt1"),
    "slotix/services/evt1",
  );
});

test("buildProviderId бросает на неизвестный assetType", () => {
  assert.throws(() => provider.buildProviderId("foo", "x"));
});

test("getOgImageUrl содержит трансформацию 1200x630 для user-avatar", () => {
  const url = provider.getOgImageUrl("user-avatar", "u1");
  assert.match(url, /w_1200/);
  assert.match(url, /h_630/);
  assert.match(url, /c_fill/);
  assert.match(url, /g_auto/);
});

test("getOgImageUrl для staff-avatar", () => {
  const url = provider.getOgImageUrl("staff-avatar", "org1/u2");
  assert.match(url, /w_1200/);
  assert.match(url, /h_630/);
  assert.match(url, /slotix\/avatars\/staff\/org1\/u2/);
});

test("getOgImageUrl для org-logo", () => {
  const url = provider.getOgImageUrl("org-logo", "org1");
  assert.match(url, /w_1200/);
  assert.match(url, /h_630/);
  assert.match(url, /slotix\/orgs\/org1\/logo/);
});

test("getOgImageUrl для service-photo", () => {
  const url = provider.getOgImageUrl("service-photo", "evt1");
  assert.match(url, /w_1200/);
  assert.match(url, /h_630/);
  assert.match(url, /slotix\/services\/evt1/);
});
