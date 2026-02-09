import { describe, it } from "node:test";
import assert from "node:assert";
import {
  formatStore,
  formatEvent,
  formatMatchEntry,
  formatStandingEntry,
  formatRegistrationEntry,
  formatLeaderboardEntry,
  formatLeaderboard,
  parseRecordToWinsLosses,
} from "../lib/formatters.js";
import type {
  GameStore,
  Event,
  LeaderboardResult,
  PlayerStats,
  RoundMatchEntry,
  StandingEntry,
  RegistrationEntry,
} from "../lib/types.js";

describe("formatStore", () => {
  it("formats minimal store with name and id", () => {
    const gameStore: GameStore = {
      id: "gs1",
      store: { id: 1, name: "Test Store" },
      store_types: [],
      store_types_pretty: [],
    };
    const out = formatStore(gameStore);
    assert.ok(out.includes("**Test Store**"));
    assert.ok(out.includes("Store ID: 1"));
    assert.ok(out.includes("Game Store ID: gs1"));
  });

  it("includes address, phone, email, website when present", () => {
    const gameStore: GameStore = {
      id: "gs1",
      store: {
        id: 1,
        name: "Full Store",
        full_address: "123 Main St",
        phone_number: "555-1234",
        email: "store@example.com",
        website: "https://store.example.com",
      },
      store_types: [],
      store_types_pretty: [],
    };
    const out = formatStore(gameStore);
    assert.ok(out.includes("📍 123 Main St"));
    assert.ok(out.includes("📞 555-1234"));
    assert.ok(out.includes("📧 store@example.com"));
    assert.ok(out.includes("🌐 https://store.example.com"));
  });

  it("includes store_types_pretty when present", () => {
    const gameStore: GameStore = {
      id: "gs1",
      store: { id: 1, name: "Store" },
      store_types: ["flgs"],
      store_types_pretty: ["Friendly Local Game Store"],
    };
    const out = formatStore(gameStore);
    assert.ok(out.includes("🏷️ Types: Friendly Local Game Store"));
  });

  it("includes bio when present", () => {
    const gameStore: GameStore = {
      id: "gs1",
      store: { id: 1, name: "Store", bio: "We sell cards." },
      store_types: [],
      store_types_pretty: [],
    };
    const out = formatStore(gameStore);
    assert.ok(out.includes("We sell cards."));
  });

  it("includes social links when present", () => {
    const gameStore: GameStore = {
      id: "gs1",
      store: {
        id: 1,
        name: "Store",
        discord_url: "https://discord.gg/abc",
        facebook_url: "https://facebook.com/store",
        instagram_handle: "store",
        twitter_handle: "store",
      },
      store_types: [],
      store_types_pretty: [],
    };
    const out = formatStore(gameStore);
    assert.ok(out.includes("Discord: https://discord.gg/abc"));
    assert.ok(out.includes("Facebook: https://facebook.com/store"));
    assert.ok(out.includes("Instagram: @store"));
    assert.ok(out.includes("Twitter: @store"));
  });
});

describe("formatEvent", () => {
  it("formats minimal event with name and id", () => {
    const event: Event = {
      id: 100,
      name: "Weekly League",
      start_datetime: "2025-02-01T18:00:00Z",
    };
    const out = formatEvent(event);
    assert.ok(out.includes("**Weekly League**"));
    assert.ok(out.includes("ID: 100"));
    assert.ok(out.includes("📅"));
  });

  it("includes format, category, store, address when present", () => {
    const event: Event = {
      id: 101,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      gameplay_format: { id: "f1", name: "Constructed" },
      event_configuration_template: "template-id",
      store: { id: 1, name: "Game Store" },
      full_address: "456 Oak Ave",
    };
    const out = formatEvent(event);
    assert.ok(out.includes("🎮 Format: Constructed"));
    assert.ok(out.includes("📁 Category:"));
    assert.ok(out.includes("🏪 Store: Game Store"));
    assert.ok(out.includes("📍 456 Oak Ave"));
  });

  it("includes distance when present", () => {
    const event: Event = {
      id: 102,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      distance_in_miles: 5.5,
    };
    const out = formatEvent(event);
    assert.ok(out.includes("🚗 Distance: 5.5 miles"));
  });

  it("shows paid entry when cost_in_cents > 0", () => {
    const event: Event = {
      id: 103,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      cost_in_cents: 1500,
      currency: "USD",
    };
    const out = formatEvent(event);
    assert.ok(out.includes("💰 Entry: USD $15.00"));
  });

  it("shows free entry when cost_in_cents is 0", () => {
    const event: Event = {
      id: 104,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      cost_in_cents: 0,
    };
    const out = formatEvent(event);
    assert.ok(out.includes("💰 Entry: Free"));
  });

  it("shows participants when capacity present", () => {
    const event: Event = {
      id: 105,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      capacity: 32,
      registered_user_count: 20,
    };
    const out = formatEvent(event);
    assert.ok(out.includes("👥 Participants: 20/32"));
  });

  it("shows registered count when no capacity", () => {
    const event: Event = {
      id: 106,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      registered_user_count: 8,
    };
    const out = formatEvent(event);
    assert.ok(out.includes("👥 Registered: 8"));
  });

  it("includes display_status and settings when present", () => {
    const event: Event = {
      id: 107,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      display_status: "Upcoming",
      settings: { event_lifecycle_status: "REGISTRATION_OPEN" },
    };
    const out = formatEvent(event);
    assert.ok(out.includes("📊 Status: Upcoming"));
    assert.ok(out.includes("🎟️ Registration: registration open"));
  });

  it("includes featured and online flags when true", () => {
    const event: Event = {
      id: 108,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      is_headlining_event: true,
      event_is_online: true,
    };
    const out = formatEvent(event);
    assert.ok(out.includes("⭐ Featured Event"));
    assert.ok(out.includes("🌐 Online Event"));
  });

  it("includes description when present", () => {
    const event: Event = {
      id: 109,
      name: "Event",
      start_datetime: "2025-02-01T18:00:00Z",
      description: "Bring your deck!",
    };
    const out = formatEvent(event);
    assert.ok(out.includes("Bring your deck!"));
  });

  it("includes tournament round IDs when tournament_phases present", () => {
    const event: Event = {
      id: 110,
      name: "Store Champs",
      start_datetime: "2025-02-01T18:00:00Z",
      tournament_phases: [
        {
          id: 1,
          phase_name: "Phase 1",
          status: "COMPLETE",
          rounds: [
            { id: 415064, round_number: 1, status: "COMPLETE" },
            { id: 415067, round_number: 4, status: "COMPLETE" },
          ],
        },
      ],
    };
    const out = formatEvent(event);
    assert.ok(out.includes("Tournament rounds"));
    assert.ok(out.includes("get_tournament_round_standings"));
    assert.ok(out.includes("415064"));
    assert.ok(out.includes("415067"));
  });
});

describe("formatMatchEntry", () => {
  it("formats completed match with winner and score", () => {
    const match: RoundMatchEntry = {
      table_number: 1,
      status: "COMPLETE",
      winning_player: 15124,
      games_won_by_winner: 2,
      games_won_by_loser: 1,
      player_match_relationships: [
        { player_order: 1, player: { id: 6679, best_identifier: "Rachel Z" } },
        { player_order: 2, player: { id: 15124, best_identifier: "Joseph C" } },
      ],
    };
    const out = formatMatchEntry(match, 0);
    assert.ok(out.includes("Rachel Z vs Joseph C"));
    assert.ok(out.includes("Joseph C wins"));
    assert.ok(out.includes("2-1"));
  });

  it("prefers user_event_status.best_identifier for pairings and winner (display name)", () => {
    const match: RoundMatchEntry = {
      table_number: 1,
      status: "COMPLETE",
      winning_player: 15124,
      games_won_by_winner: 2,
      games_won_by_loser: 1,
      player_match_relationships: [
        {
          player_order: 1,
          player: { id: 6679, best_identifier: "Rachel Z" },
          user_event_status: { best_identifier: "Rachel Zammitt" },
        },
        {
          player_order: 2,
          player: { id: 15124, best_identifier: "Joseph C" },
          user_event_status: { best_identifier: "JC22" },
        },
      ],
    };
    const out = formatMatchEntry(match, 0);
    assert.ok(out.includes("Rachel Zammitt vs JC22"));
    assert.ok(out.includes("JC22 wins"));
  });

  it("formats bye match", () => {
    const match: RoundMatchEntry = {
      table_number: 2,
      match_is_bye: true,
      player_match_relationships: [
        { player_order: 1, player: { best_identifier: "Alice" } },
      ],
    };
    const out = formatMatchEntry(match, 0);
    assert.ok(out.includes("Bye"));
  });

  it("formats draw", () => {
    const match: RoundMatchEntry = {
      match_is_intentional_draw: true,
      player_match_relationships: [
        { player_order: 1, player: { best_identifier: "A" } },
        { player_order: 2, player: { best_identifier: "B" } },
      ],
    };
    const out = formatMatchEntry(match, 0);
    assert.ok(out.includes("A vs B"));
    assert.ok(out.includes("Draw"));
  });

  it("falls back to status when no winner", () => {
    const match: RoundMatchEntry = {
      status: "IN_PROGRESS",
      player_match_relationships: [
        { player_order: 1, player: { best_identifier: "X" } },
        { player_order: 2, player: { best_identifier: "Y" } },
      ],
    };
    const out = formatMatchEntry(match, 0);
    assert.ok(out.includes("X vs Y"));
    assert.ok(out.includes("IN_PROGRESS"));
  });
});

describe("formatStandingEntry", () => {
  it("falls back to username when player_name and display_name missing", () => {
    const entry: StandingEntry = { username: "player1" };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("1. player1"));
  });

  it("uses player.best_identifier when present (API shape)", () => {
    const entry: StandingEntry = { player: { best_identifier: "Corey J" }, rank: 1 };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("1. Corey J"));
  });

  it("prefers user_event_status.best_identifier over player.best_identifier (display name)", () => {
    const entry: StandingEntry = {
      rank: 1,
      player: { best_identifier: "Joseph C" },
      user_event_status: { best_identifier: "JC22" },
    };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("1. JC22"));
  });

  it("uses em dash when no name fields", () => {
    const entry: StandingEntry = {};
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("1. —"));
  });

  it("shows record with only wins (losses 0)", () => {
    const entry: StandingEntry = { player_name: "A", wins: 3 };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("Record: 3-0"));
  });

  it("shows record from record/match_record (API shape)", () => {
    const entry: StandingEntry = { player: { best_identifier: "X" }, record: "3-0-1", match_points: 10 };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("Record: 3-0-1"));
    assert.ok(out.includes("Match points: 10"));
  });

  it("shows OMWP/GWP from opponent_match_win_percentage and game_win_percentage", () => {
    const entry: StandingEntry = {
      player_name: "Y",
      opponent_match_win_percentage: 0.645,
      game_win_percentage: 0.636,
    };
    const out = formatStandingEntry(entry, 0);
    assert.ok(out.includes("OMWP: 64.5%"));
    assert.ok(out.includes("GWP: 63.6%"));
  });
});

describe("formatRegistrationEntry", () => {
  it("falls back to em dash when no name available", () => {
    const entry: RegistrationEntry = {};
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.includes("1. —"));
  });

  it("uses best_identifier when present (API shape)", () => {
    const entry: RegistrationEntry = { best_identifier: "Corey J", user: { best_identifier: "Corex" } };
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.includes("1. Corey J"));
  });

  it("uses user.best_identifier when top-level best_identifier missing", () => {
    const entry: RegistrationEntry = { user: { best_identifier: "Deviknyte" } };
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.includes("1. Deviknyte"));
  });

  it("uses user.username when display_name missing", () => {
    const entry: RegistrationEntry = { user: { username: "u1" } };
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.includes("1. u1"));
  });

  it("includes Registered line for invalid date string (Invalid Date or raw fallback)", () => {
    const entry: RegistrationEntry = {
      display_name: "X",
      registered_at: "not-a-date",
    };
    const out = formatRegistrationEntry(entry, 0);
    assert.ok(out.includes("Registered:"), "should include Registered line");
    // new Date("not-a-date") does not throw; toLocaleString() yields "Invalid Date" in most envs
    assert.ok(
      out.includes("Invalid Date") || out.includes("not-a-date"),
      "should show Invalid Date or raw value"
    );
  });
});

describe("parseRecordToWinsLosses", () => {
  it("parses W-L format", () => {
    assert.deepStrictEqual(parseRecordToWinsLosses("3-0"), { wins: 3, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses("4-2"), { wins: 4, losses: 2 });
    assert.deepStrictEqual(parseRecordToWinsLosses("0-3"), { wins: 0, losses: 3 });
  });

  it("parses W-L-T format (uses first two numbers)", () => {
    assert.deepStrictEqual(parseRecordToWinsLosses("3-0-1"), { wins: 3, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses("2-1-1"), { wins: 2, losses: 1 });
  });

  it("returns zeros for undefined, empty, or unparseable", () => {
    assert.deepStrictEqual(parseRecordToWinsLosses(undefined), { wins: 0, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses(""), { wins: 0, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses("  "), { wins: 0, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses("invalid"), { wins: 0, losses: 0 });
    assert.deepStrictEqual(parseRecordToWinsLosses("3"), { wins: 0, losses: 0 });
  });

  it("handles spaces around dashes", () => {
    assert.deepStrictEqual(parseRecordToWinsLosses("3 - 0 - 1"), { wins: 3, losses: 0 });
  });
});

describe("formatLeaderboardEntry", () => {
  it("formats entry with wins, losses, events, win rate, best and avg placement, 1st places", () => {
    const entry: PlayerStats = {
      playerName: "Alice",
      totalWins: 10,
      totalLosses: 2,
      eventsPlayed: 3,
      bestPlacement: 1,
      firstPlaceFinishes: 1,
      placements: [1, 3, 2],
    };
    const out = formatLeaderboardEntry(entry, 1);
    assert.ok(out.includes("1. Alice"));
    assert.ok(out.includes("Wins: 10"));
    assert.ok(out.includes("Losses: 2"));
    assert.ok(out.includes("Events: 3"));
    assert.ok(out.includes("Win Rate: 83.3%"));
    assert.ok(out.includes("Best: 1st"));
    assert.ok(out.includes("Avg: 2.0"));
    assert.ok(out.includes("1st places: 1"));
  });

  it("shows em dash for win rate when no games", () => {
    const entry: PlayerStats = {
      playerName: "Bob",
      totalWins: 0,
      totalLosses: 0,
      eventsPlayed: 1,
      bestPlacement: 5,
      firstPlaceFinishes: 0,
      placements: [5],
    };
    const out = formatLeaderboardEntry(entry, 2);
    assert.ok(out.includes("Win Rate: —%"));
  });

  it("formats 2nd and 3rd placement suffixes", () => {
    const second: PlayerStats = {
      playerName: "Second",
      totalWins: 0,
      totalLosses: 0,
      eventsPlayed: 1,
      bestPlacement: 2,
      firstPlaceFinishes: 0,
      placements: [2],
    };
    const third: PlayerStats = {
      playerName: "Third",
      totalWins: 0,
      totalLosses: 0,
      eventsPlayed: 1,
      bestPlacement: 3,
      firstPlaceFinishes: 0,
      placements: [3],
    };
    assert.ok(formatLeaderboardEntry(second, 1).includes("Best: 2nd"));
    assert.ok(formatLeaderboardEntry(third, 1).includes("Best: 3rd"));
  });
});

describe("formatLeaderboard", () => {
  it("includes period, events analyzed, and sort label", () => {
    const result: LeaderboardResult = {
      players: [],
      eventsAnalyzed: 5,
      eventsIncluded: [],
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
    };
    const out = formatLeaderboard(result, "TOTAL WINS");
    assert.ok(out.includes("Player Leaderboard"));
    assert.ok(out.includes("2026-01-01 – 2026-01-31"));
    assert.ok(out.includes("Events analyzed: 5"));
    assert.ok(out.includes("TOP PLAYERS BY TOTAL WINS"));
  });

  it("includes filter context when present", () => {
    const result: LeaderboardResult = {
      players: [],
      eventsAnalyzed: 0,
      eventsIncluded: [],
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
      filters: { city: "Detroit, MI", categories: ["Set Championship"] },
    };
    const out = formatLeaderboard(result, "TOTAL WINS");
    assert.ok(out.includes("near Detroit, MI"));
    assert.ok(out.includes("Set Championship"));
  });

  it("includes store in filter context when present", () => {
    const result: LeaderboardResult = {
      players: [],
      eventsAnalyzed: 0,
      eventsIncluded: [],
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
      filters: { store: "Game Haven", formats: ["Constructed"] },
    };
    const out = formatLeaderboard(result, "TOTAL WINS");
    assert.ok(out.includes("at Game Haven"));
    assert.ok(out.includes("Constructed"));
  });

  it("lists events included", () => {
    const result: LeaderboardResult = {
      players: [
        {
          playerName: "Alice",
          totalWins: 3,
          totalLosses: 0,
          eventsPlayed: 1,
          bestPlacement: 1,
          firstPlaceFinishes: 1,
          placements: [1],
        },
      ],
      eventsAnalyzed: 1,
      eventsIncluded: [
        { id: 100, name: "Championship Jan 5", startDate: "2026-01-05T18:00:00Z" },
      ],
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
    };
    const out = formatLeaderboard(result, "TOTAL WINS");
    assert.ok(out.includes("1. Alice"));
    assert.ok(out.includes("Events included:"));
    assert.ok(out.includes("Championship Jan 5"));
    assert.ok(out.includes("ID: 100"));
  });
});
