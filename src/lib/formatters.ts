/**
 * Human-readable formatters for events, stores, standings, and registrations.
 */

import { getCategoryName } from "./api.js";
import type { Event, GameStore, RegistrationEntry, StandingEntry } from "./types.js";

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

export function formatStandingEntry(entry: StandingEntry, index: number): string {
  const rank = entry.rank ?? entry.placement ?? index + 1;
  const name = entry.player_name ?? entry.display_name ?? entry.username ?? "—";
  const lines: string[] = [`${rank}. ${name}`];
  if (entry.wins !== undefined || entry.losses !== undefined) {
    lines.push(`   Record: ${entry.wins ?? 0}-${entry.losses ?? 0}`);
  }
  if (entry.match_points !== undefined) {
    lines.push(`   Match points: ${entry.match_points}`);
  }
  if (entry.opponent_match_win_pct !== undefined) {
    lines.push(`   OMWP: ${(Number(entry.opponent_match_win_pct) * 100).toFixed(1)}%`);
  }
  if (entry.game_win_pct !== undefined) {
    lines.push(`   GWP: ${(Number(entry.game_win_pct) * 100).toFixed(1)}%`);
  }
  return lines.join("\n");
}

export function formatRegistrationEntry(entry: RegistrationEntry, index: number): string {
  const name =
    entry.display_name ??
    entry.username ??
    (entry.user &&
      (entry.user.display_name ??
        entry.user.username ??
        [entry.user.first_name, entry.user.last_name].filter(Boolean).join(" "))) ??
    "—";
  const lines: string[] = [`${index + 1}. ${name}`];
  if (entry.status) {
    lines.push(`   Status: ${entry.status}`);
  }
  if (entry.registered_at) {
    try {
      const d = new Date(entry.registered_at);
      lines.push(`   Registered: ${d.toLocaleString()}`);
    } catch {
      lines.push(`   Registered: ${entry.registered_at}`);
    }
  }
  return lines.join("\n");
}

export function formatEvent(event: Event): string {
  const lines: string[] = [`**${event.name}** (ID: ${event.id})`];

  if (event.start_datetime) {
    const startDate = new Date(event.start_datetime);
    lines.push(
      `📅 ${startDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    );
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

  return lines.join("\n");
}
