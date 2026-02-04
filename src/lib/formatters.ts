/**
 * Human-readable formatters for events, stores, standings, and registrations.
 */

import { getCategoryName } from "./api.js";
import type {
  Event,
  GameStore,
  LeaderboardResult,
  PlayerStats,
  RegistrationEntry,
  RoundMatchEntry,
  StandingEntry,
} from "./types.js";

export function formatStore(gameStore: GameStore): string {
  const store = gameStore.store;
  const lines: string[] = [`**${store.name}** (Store ID: ${store.id})`];

  if (store.full_address) {
    lines.push(`📍 ${store.full_address}`);
  }

  if (store.phone_number) {
    lines.push(`📞 ${store.phone_number}`);
  }

  if (store.email) {
    lines.push(`📧 ${store.email}`);
  }

  if (store.website) {
    lines.push(`🌐 ${store.website}`);
  }

  if (gameStore.store_types_pretty && gameStore.store_types_pretty.length > 0) {
    lines.push(`🏷️ Types: ${gameStore.store_types_pretty.join(", ")}`);
  }

  if (store.bio) {
    lines.push(`\n${store.bio}`);
  }

  const socials: string[] = [];
  if (store.discord_url) socials.push(`Discord: ${store.discord_url}`);
  if (store.facebook_url) socials.push(`Facebook: ${store.facebook_url}`);
  if (store.instagram_handle) socials.push(`Instagram: @${store.instagram_handle}`);
  if (store.twitter_handle) socials.push(`Twitter: @${store.twitter_handle}`);

  if (socials.length > 0) {
    lines.push(`\n${socials.join(" | ")}`);
  }

  return lines.join("\n");
}

export function formatMatchEntry(match: RoundMatchEntry, index: number): string {
  const rels = match.player_match_relationships ?? [];
  const names = rels
    .slice()
    .sort((a, b) => (a.player_order ?? 0) - (b.player_order ?? 0))
    .map((r) => r.player?.best_identifier ?? "—");
  const vs = names.length >= 2 ? `${names[0]} vs ${names[1]}` : names[0] ?? "—";
  const table = match.table_number != null ? `Table ${match.table_number}` : "";
  const prefix = table ? `${table}: ` : "";
  if (match.match_is_bye) {
    return `${prefix}${vs} — Bye`;
  }
  if (match.match_is_intentional_draw || match.match_is_unintentional_draw) {
    return `${prefix}${vs} — Draw`;
  }
  if (match.winning_player != null && match.status === "COMPLETE") {
    const winnerRel = rels.find((r) => r.player?.id === match.winning_player);
    const winner = winnerRel?.player?.best_identifier ?? `Player ${match.winning_player}`;
    const score =
      match.games_won_by_winner != null && match.games_won_by_loser != null
        ? ` ${match.games_won_by_winner}-${match.games_won_by_loser}`
        : "";
    return `${prefix}${vs} — ${winner} wins${score}`;
  }
  const status = match.status ?? "—";
  return `${prefix}${vs} — ${status}`;
}

export function formatStandingEntry(entry: StandingEntry, index: number): string {
  const rank = entry.rank ?? entry.placement ?? index + 1;
  const name =
    entry.player?.best_identifier ??
    entry.player_name ??
    entry.display_name ??
    entry.username ??
    "—";
  const lines: string[] = [`${rank}. ${name}`];
  const record =
    entry.record ?? entry.match_record ?? (entry.wins !== undefined || entry.losses !== undefined ? `${entry.wins ?? 0}-${entry.losses ?? 0}` : undefined);
  if (record) {
    lines.push(`   Record: ${record}`);
  }
  if (entry.match_points !== undefined) {
    lines.push(`   Match points: ${entry.match_points}`);
  }
  const omwp = entry.opponent_match_win_pct ?? entry.opponent_match_win_percentage;
  if (omwp !== undefined) {
    lines.push(`   OMWP: ${(Number(omwp) * 100).toFixed(1)}%`);
  }
  const gwp = entry.game_win_pct ?? entry.game_win_percentage;
  if (gwp !== undefined) {
    lines.push(`   GWP: ${(Number(gwp) * 100).toFixed(1)}%`);
  }
  return lines.join("\n");
}

export function formatRegistrationEntry(entry: RegistrationEntry, index: number): string {
  const name =
    entry.best_identifier ??
    entry.user?.best_identifier ??
    entry.display_name ??
    entry.username ??
    (entry.user &&
      (entry.user.display_name ??
        entry.user.username ??
        [entry.user.first_name, entry.user.last_name].filter(Boolean).join(" "))) ??
    "—";
  const lines: string[] = [`${index + 1}. ${name}`];
  const status = entry.registration_status ?? entry.status;
  if (status) {
    lines.push(`   Status: ${status}`);
  }
  const regAt = entry.registration_completed_datetime ?? entry.registered_at;
  if (regAt) {
    try {
      const d = new Date(regAt);
      lines.push(`   Registered: ${d.toLocaleString()}`);
    } catch {
      lines.push(`   Registered: ${regAt}`);
    }
  }
  return lines.join("\n");
}

export function formatEvent(event: Event): string {
  const lines: string[] = [`**${event.name}** (ID: ${event.id})`];

  if (event.start_datetime) {
    // Output raw ISO date - clients can parse/format as needed (e.g., Discord timestamps)
    lines.push(`📅 ${event.start_datetime}`);
  }

  if (event.gameplay_format?.name) {
    lines.push(`🎮 Format: ${event.gameplay_format.name}`);
  }

  if (event.event_configuration_template) {
    lines.push(`📁 Category: ${getCategoryName(event.event_configuration_template)}`);
  }

  if (event.store?.name) {
    lines.push(`🏪 Store: ${event.store.name}`);
  }

  if (event.full_address) {
    lines.push(`📍 ${event.full_address}`);
  }

  if (event.distance_in_miles != null) {
    lines.push(`🚗 Distance: ${event.distance_in_miles.toFixed(1)} miles`);
  }

  if (event.cost_in_cents !== undefined) {
    if (event.cost_in_cents > 0) {
      const cost = event.cost_in_cents / 100;
      lines.push(`💰 Entry: ${event.currency || "USD"} $${cost.toFixed(2)}`);
    } else {
      lines.push(`💰 Entry: Free`);
    }
  }

  if (event.capacity) {
    const registered = event.registered_user_count || 0;
    lines.push(`👥 Participants: ${registered}/${event.capacity}`);
  } else if (event.registered_user_count !== undefined) {
    lines.push(`👥 Registered: ${event.registered_user_count}`);
  }

  if (event.display_status) {
    lines.push(`📊 Status: ${event.display_status}`);
  }

  if (event.settings?.event_lifecycle_status) {
    lines.push(
      `🎟️ Registration: ${event.settings.event_lifecycle_status.replace(/_/g, " ").toLowerCase()}`
    );
  }

  if (event.is_headlining_event) {
    lines.push(`⭐ Featured Event`);
  }

  if (event.event_is_online) {
    lines.push(`🌐 Online Event`);
  }

  if (event.description) {
    lines.push(`\n${event.description}`);
  }

  // Include tournament round IDs so callers can use get_tournament_round_standings (e.g. for results/summary).
  if (event.tournament_phases && event.tournament_phases.length > 0) {
    const roundParts: string[] = [];
    for (const phase of event.tournament_phases) {
      if (phase.rounds && phase.rounds.length > 0) {
        for (const r of phase.rounds) {
          const label = phase.phase_name ? `Round ${r.round_number} (${phase.phase_name})` : `Round ${r.round_number}`;
          roundParts.push(`${label}: ID ${r.id}${r.status ? ` (${r.status})` : ""}`);
        }
      }
    }
    if (roundParts.length > 0) {
      lines.push(`\n🏆 Tournament rounds (use get_tournament_round_standings with round ID for standings):`);
      lines.push(roundParts.join("\n"));
    }
  }

  return lines.join("\n");
}

/** Parse record string (e.g. "3-0-1" or "4-2") to wins and losses. Returns { wins: 0, losses: 0 } if unparseable. */
export function parseRecordToWinsLosses(record: string | undefined): { wins: number; losses: number } {
  if (typeof record !== "string" || !record.trim()) return { wins: 0, losses: 0 };
  const parts = record.split("-").map((s) => parseInt(s.trim(), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return { wins: parts[0], losses: parts[1] };
  }
  return { wins: 0, losses: 0 };
}

export function formatLeaderboardEntry(entry: PlayerStats, rank: number): string {
  const winRate =
    entry.totalWins + entry.totalLosses > 0
      ? ((entry.totalWins / (entry.totalWins + entry.totalLosses)) * 100).toFixed(1)
      : "—";
  const avgPlace =
    entry.placements.length > 0
      ? (entry.placements.reduce((a, b) => a + b, 0) / entry.placements.length).toFixed(1)
      : "—";
  const ord = entry.bestPlacement === 1 ? "st" : entry.bestPlacement === 2 ? "nd" : entry.bestPlacement === 3 ? "rd" : "th";
  const lines: string[] = [
    `${rank}. ${entry.playerName}`,
    `   Wins: ${entry.totalWins} | Losses: ${entry.totalLosses} | Events: ${entry.eventsPlayed} | Win Rate: ${winRate}%`,
    `   Best: ${entry.bestPlacement}${ord} | Avg: ${avgPlace} | 1st places: ${entry.firstPlaceFinishes}`,
  ];
  return lines.join("\n");
}

export function formatLeaderboard(result: LeaderboardResult, sortLabel: string): string {
  const lines: string[] = [];
  const filterParts: string[] = [];
  if (result.filters?.city) filterParts.push(`near ${result.filters.city}`);
  if (result.filters?.store) filterParts.push(`at ${result.filters.store}`);
  if (result.filters?.categories?.length) filterParts.push(result.filters.categories.join(", "));
  if (result.filters?.formats?.length) filterParts.push(result.filters.formats.join(", "));
  const filterStr = filterParts.length > 0 ? ` (${filterParts.join(" | ")})` : "";

  lines.push(`Player Leaderboard${filterStr}`);
  lines.push(
    `Period: ${result.dateRange.start} – ${result.dateRange.end} | Events analyzed: ${result.eventsAnalyzed}`
  );
  lines.push("");
  lines.push(`🏆 TOP PLAYERS BY ${sortLabel}`);
  lines.push("");

  for (let i = 0; i < result.players.length; i++) {
    lines.push(formatLeaderboardEntry(result.players[i], i + 1));
    lines.push("");
  }

  lines.push("Events included:");
  for (const e of result.eventsIncluded) {
    lines.push(`- ${e.name} (ID: ${e.id}) — ${e.startDate}`);
  }

  return lines.join("\n");
}
