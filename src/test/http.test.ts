/**
 * Unit tests for HTTP retry helpers.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { getJitteredBackoffDelayMs, parseRetryAfterMs } from "../lib/http.js";

describe("http retry helpers", () => {
  it("parseRetryAfterMs parses seconds", () => {
    assert.strictEqual(parseRetryAfterMs("1.5", 0), 1500);
    assert.strictEqual(parseRetryAfterMs("0", 0), 0);
  });

  it("parseRetryAfterMs parses HTTP date", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const inTwoSeconds = new Date(now + 2000).toUTCString();
    assert.strictEqual(parseRetryAfterMs(inTwoSeconds, now), 2000);
  });

  it("parseRetryAfterMs returns null for invalid values", () => {
    assert.strictEqual(parseRetryAfterMs(null, 0), null);
    assert.strictEqual(parseRetryAfterMs("", 0), null);
    assert.strictEqual(parseRetryAfterMs("not-a-date", 0), null);
    assert.strictEqual(parseRetryAfterMs("-5", 0), null);
  });

  it("getJitteredBackoffDelayMs uses bounded jitter and exponential growth", () => {
    // attempt 2 => base 100 * 2^2 = 400; min jitter (0.5x) => 200.
    assert.strictEqual(getJitteredBackoffDelayMs(2, 100, 0), 200);
    // max jitter (1.5x) => 600.
    assert.strictEqual(getJitteredBackoffDelayMs(2, 100, 1), 600);
  });

  it("getJitteredBackoffDelayMs is capped", () => {
    assert.strictEqual(getJitteredBackoffDelayMs(10, 5000, 1), 5000);
  });
});
