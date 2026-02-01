import { describe, it } from "node:test";
import assert from "node:assert";
import { formatStandingEntry } from "../lib/formatters.js";
import type { StandingEntry } from "../lib/types.js";

describe("formatStandingEntry", () => {
  it("formats entry with rank and player_name", () => {
    const entry: StandingEntry = { rank: 1, player_name: "Alice" };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.startsWith("1. Alice"));
  });

  it("falls back to placement and display_name", () => {
    const entry: StandingEntry = { placement: 2, display_name: "Bob" };
    const out = formatStandingEntry(entry, 1);
    assert.ok(out.includes("2. Bob"));
  });

  it("uses index when rank/placement missing", () => {
    const entry: StandingEntry = { player_name: "Charlie" };
    const out = formatStandingEntry(entry, 2);
    assert.ok(out.startsWith("3. Charlie"));
  });

  it("includes record when wins/losses present", () => {
    const entry: StandingEntry = {
      rank: 1,
      player_name: "Dana",
      wins: 3,
      losses: 1,
    };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("Record: 3-1"));
  });

  it("includes match_points and percentages when present", () => {
    const entry: StandingEntry = {
      rank: 1,
      player_name: "Eve",
      match_points: 9,
      opponent_match_win_pct: 0.6,
      game_win_pct: 0.75,
    };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("Match points: 9"));
    assert.ok(out.includes("OMWP: 60.0%"));
    assert.ok(out.includes("GWP: 75.0%"));
  });
});
