import { describe, it } from "node:test";
import assert from "node:assert";
import { formatStandingEntry } from "../lib/formatters.js";
import type { LeaderboardResult, StandingEntry } from "../lib/types.js";

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

  it("prefers user_event_status.best_identifier when present (display name over First L)", () => {
    const entry: StandingEntry = {
      rank: 1,
      player: { best_identifier: "Devin R" },
      user_event_status: { best_identifier: "Deviknyte" },
    };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.startsWith("1. Deviknyte"));
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

describe("Leaderboard by store (type contract)", () => {
  it("LeaderboardResult filters may include store for get_player_leaderboard_by_store", () => {
    const result: LeaderboardResult = {
      players: [],
      eventsAnalyzed: 0,
      eventsIncluded: [],
      dateRange: { start: "2025-01-01", end: "2025-01-31" },
      filters: { store: "Game Haven", categories: ["Set Championship"] },
    };
    assert.strictEqual(result.filters?.store, "Game Haven");
    assert.deepStrictEqual(result.filters?.categories, ["Set Championship"]);
  });
});
