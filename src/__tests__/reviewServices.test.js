import { test } from "node:test";
import assert from "node:assert/strict";

test("Rating value: integer 1-5 is valid", () => {
  const validValues = [1, 2, 3, 4, 5];
  validValues.forEach((v) => {
    assert.equal(Number.isInteger(v) && v >= 1 && v <= 5, true);
  });
});

test("Rating value: 0, 6, 3.5, 'a' invalid", () => {
  const invalid = [0, 6, 3.5, "a", null, undefined];
  invalid.forEach((v) => {
    const ok = Number.isInteger(v) && v >= 1 && v <= 5;
    assert.equal(ok, false);
  });
});

test("Comment body trim length 1-1000", () => {
  const ok = (raw) => {
    if (typeof raw !== "string") return false;
    const t = raw.trim();
    return t.length >= 1 && t.length <= 1000;
  };
  assert.equal(ok(""), false);
  assert.equal(ok("   "), false);
  assert.equal(ok("a"), true);
  assert.equal(ok("a".repeat(1000)), true);
  assert.equal(ok("a".repeat(1001)), false);
  assert.equal(ok(null), false);
});
