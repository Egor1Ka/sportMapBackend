import { test } from "node:test";
import assert from "node:assert/strict";
import { createOauthState, validateOauthState } from "../services/authServices.js";

test("oauth state round-trip with timezone", () => {
  const { state, cookieValue } = createOauthState("Europe/Berlin");
  const decoded = validateOauthState(cookieValue, state);
  assert.equal(decoded.timezone, "Europe/Berlin");
});

test("oauth state rejects invalid timezone", () => {
  assert.throws(() => createOauthState("Mars/Phobos"), { message: "invalid_timezone" });
});

test("oauth state rejects missing timezone", () => {
  assert.throws(() => createOauthState(undefined), { message: "invalid_timezone" });
});

test("oauth state rejects state mismatch", () => {
  const { cookieValue } = createOauthState("Europe/Kyiv");
  assert.throws(() => validateOauthState(cookieValue, "wrong-state"), { message: "invalid_state" });
});

test("oauth state rejects missing cookie", () => {
  assert.throws(() => validateOauthState(undefined, "some-state"), { message: "missing_state" });
});
