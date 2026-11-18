import assert from "node:assert/strict";
import { test } from "node:test";
import { makeLimiter } from "../src/limit.mjs";

test("allows up to the limit, then refuses, and says once when the line was crossed", () => {
  const allow = makeLimiter(3, 1000);
  assert.deepEqual(
    [1, 2, 3].map(() => allow("a", 0).ok),
    [true, true, true],
  );
  assert.deepEqual(allow("a", 1), { ok: false, first: true });
  assert.deepEqual(allow("a", 2), { ok: false, first: false });
});

test("each address has its own count, and a new window starts fresh", () => {
  const allow = makeLimiter(1, 1000);
  assert.equal(allow("a", 0).ok, true);
  assert.equal(allow("a", 1).ok, false);
  assert.equal(allow("b", 1).ok, true);
  assert.equal(allow("a", 1000).ok, true);
});
