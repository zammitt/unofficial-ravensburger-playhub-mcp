import { describe, it } from "node:test";
import assert from "node:assert";
import { formatRegistrationEntry } from "../lib/formatters.js";
import type { RegistrationEntry } from "../lib/types.js";

describe("formatRegistrationEntry", () => {
  it("formats entry with display_name", () => {
    const entry: RegistrationEntry = { display_name: "Alice" };
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.startsWith("1. Alice"));
  });

  it("falls back to username", () => {
    const entry: RegistrationEntry = { username: "bob123" };
    const out = formatRegistrationEntry(entry, 1);
    assert.ok(out.includes("2. bob123"));
  });

  it("uses user.display_name when present", () => {
    const entry: RegistrationEntry = { user: { display_name: "Charlie Z" } };
    const out = formatRegistrationEntry(entry, 2);
    assert.ok(out.includes("3. Charlie Z"));
  });

  it("uses user first_name and last_name when present", () => {
    const entry: RegistrationEntry = {
      user: { first_name: "Dana", last_name: "Smith" },
    };
    const out = formatRegistrationEntry(entry, 3);
    assert.ok(out.includes("4. Dana Smith"));
  });

  it("includes status and registered_at when present", () => {
    const entry: RegistrationEntry = {
      display_name: "Eve",
      status: "confirmed",
      registered_at: "2025-01-15T10:00:00Z",
    };
    const out = formatRegistrationEntry(entry, 4);
    assert.ok(out.includes("Status: confirmed"));
    assert.ok(out.includes("Registered:"));
  });
});
