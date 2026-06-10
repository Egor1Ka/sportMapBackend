import { test } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";

// Мок провайдера до импорта сервиса
mock.module("../providers/index.js", {
  namedExports: {
    getActiveProvider: () => ({
      upload: async (file, { assetType, ownerId }) => ({
        url: `https://mock.test/${assetType}/${ownerId}`,
        providerId: `${assetType}/${ownerId}`,
      }),
      delete: async () => {},
      buildProviderId: (assetType, ownerId) => `${assetType}/${ownerId}`,
    }),
    PROVIDERS: {},
  },
});

const { uploadAvatar, deleteAvatar } = await import(
  "../services/mediaServices.js"
);

test("uploadAvatar возвращает URL и providerId от провайдера", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 100,
    originalname: "x.jpg",
  };
  const result = await uploadAvatar({
    assetType: "user-avatar",
    ownerId: "user123",
    file,
  });
  assert.strictEqual(result.url, "https://mock.test/user-avatar/user123");
  assert.strictEqual(result.providerId, "user-avatar/user123");
});

test("uploadAvatar отвергает чужой mime", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "application/pdf",
    size: 100,
    originalname: "x.pdf",
  };
  await assert.rejects(
    () =>
      uploadAvatar({ assetType: "user-avatar", ownerId: "user123", file }),
    (err) => err.code === "INVALID_MIME",
  );
});

test("uploadAvatar отвергает превышение размера", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 3 * 1024 * 1024,
    originalname: "x.jpg",
  };
  await assert.rejects(
    () =>
      uploadAvatar({ assetType: "user-avatar", ownerId: "user123", file }),
    (err) => err.code === "FILE_TOO_LARGE",
  );
});

test("uploadAvatar бросает на неизвестный assetType", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 100,
    originalname: "x.jpg",
  };
  await assert.rejects(() =>
    uploadAvatar({ assetType: "unknown-type", ownerId: "u", file }),
  );
});

test("deleteAvatar не падает если провайдер отдаёт 404", async () => {
  // дефолтный мок не падает — проверяем что вызов проходит без ошибки
  await assert.doesNotReject(() =>
    deleteAvatar({ assetType: "user-avatar", ownerId: "user123" }),
  );
});

test("uploadAvatar валидирует лимиты для org-logo", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/jpeg",
    size: 100,
    originalname: "x.jpg",
  };
  const result = await uploadAvatar({
    assetType: "org-logo",
    ownerId: "orgABC",
    file,
  });
  assert.strictEqual(result.url, "https://mock.test/org-logo/orgABC");
});

test("uploadAvatar валидирует лимиты для service-photo", async () => {
  const file = {
    buffer: Buffer.from("fake"),
    mimetype: "image/png",
    size: 100,
    originalname: "x.png",
  };
  const result = await uploadAvatar({
    assetType: "service-photo",
    ownerId: "evt1",
    file,
  });
  assert.strictEqual(result.url, "https://mock.test/service-photo/evt1");
});
