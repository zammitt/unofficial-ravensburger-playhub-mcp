/**
 * MCP tools for event search, details, registrations, and tournament standings.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  expandStatusesForApi,
  fetchAllEventStandings,
  fetchEventDetails,
  fetchEventRegistrations,
  fetchEvents,
  fetchTournamentRoundMatches,
  fetchTournamentRoundStandings,
  resolveCategoryIds,
  resolveCategoryIdsStrict,
  resolveFormatIds,
  resolveFormatIdsStrict,
  STATUSES,
} from "../lib/api.js";
import {
  formatEvent,
  formatLeaderboard,
  formatMatchEntry,
  formatRegistrationEntry,
  formatStandingEntry,
  parseRecordToWinsLosses,
} from "../lib/formatters.js";
import type { LeaderboardResult, PlayerStats, StandingEntry } from "../lib/types.js";

export function registerEventTools(server: McpServer): void {
  // Tool: Search Events
  server.registerTool(
    "search_events",
    {
      description:
        "Search for Disney Lorcana TCG events near a location by latitude/longitude. Use this when you have coordinates (e.g. from a map or device). For city names like 'Seattle' or 'Austin, TX', use search_events_by_city instead. Optional: call list_filters first to get format/category names for the formats and categories parameters.",
      inputSchema: {
        latitude: z.number().describe("Latitude of the search center (e.g. 42.33)"),
        longitude: z.number().describe("Longitude of the search center (e.g. -83.05)"),
        radius_miles: z.number().default(25).describe("Search radius in miles (default: 25)"),
        start_date: z.string().optional().describe("Only show events starting on or after this date in UTC (YYYY-MM-DD)"),
        end_date: z.string().optional().describe("Only show events starting before this date in UTC (YYYY-MM-DD)"),
        formats: z.array(z.string()).optional().describe("Filter by format names; get exact names from list_filters (e.g. ['Constructed'])"),
        categories: z.array(z.string()).optional().describe("Filter by category names; get exact names from list_filters"),
        statuses: z.array(z.enum(STATUSES)).default(["upcoming", "inProgress"]).describe("Include: upcoming, inProgress (live), past, or all (all three)"),
        featured_only: z.boolean().default(false).describe("If true, only featured/headlining events"),
        text_search: z.string().optional().describe("Search event names by keyword"),
        store_id: z.number().optional().describe("Limit to events at this store (ID from search_stores)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      const params: Record<string, string | string[]> = {
        game_slug: "disney-lorcana",
        latitude: args.latitude.toString(),
        longitude: args.longitude.toString(),
        num_miles: args.radius_miles.toString(),
        page: args.page.toString(),
        page_size: Math.min(args.page_size, 100).toString(),
      };

      params.display_statuses = expandStatusesForApi(args.statuses as string[]);

      if (args.start_date) {
        params.start_date_after = new Date(args.start_date + "T00:00:00Z").toISOString();
      } else {
        // Default to start of today (UTC)
        const now = new Date();
        const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        params.start_date_after = startOfToday.toISOString();
      }

      if (args.end_date) {
        params.start_date_before = new Date(args.end_date + "T00:00:00Z").toISOString();
      }

      if (args.formats && args.formats.length > 0) {
        const formatIds = resolveFormatIds(args.formats);
        if (formatIds.length > 0) {
          params.gameplay_format_id = formatIds;
        }
      }

      if (args.categories && args.categories.length > 0) {
        const categoryIds = resolveCategoryIds(args.categories);
        if (categoryIds.length > 0) {
          params.event_configuration_template_id = categoryIds;
        }
      }

      if (args.featured_only) {
        params.is_headlining_event = "true";
      }

      if (args.text_search) {
        params.name = args.text_search;
      }

      if (args.store_id) {
        params.store = args.store_id.toString();
      }

      try {
        const response = await fetchEvents(params);

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No events found matching your criteria. Try expanding your search radius or adjusting filters.",
              },
            ],
          };
        }

        const formattedEvents = response.results.map(formatEvent).join("\n\n---\n\n");
        const summary = `Found ${response.count} event(s). Showing ${response.results.length} (page ${args.page} of ${Math.ceil(response.count / args.page_size)}).`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${formattedEvents}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching events: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Event Details
  server.registerTool(
    "get_event_details",
    {
      description:
        "Get full details for one Disney Lorcana event by ID. Use after search_events or search_events_by_city when the user asks for more info, results, or standings. For tournaments, the response includes tournament round IDs—use the latest completed round ID with get_tournament_round_standings to get current/final standings and results.",
      inputSchema: {
        event_id: z.number().describe("Event ID (e.g. from search results)"),
      },
    },
    async (args) => {
      try {
        const event = await fetchEventDetails(args.event_id);
        return {
          content: [
            {
              type: "text" as const,
              text: formatEvent(event),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching event details: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Tournament Round Standings
  server.registerTool(
    "get_tournament_round_standings",
    {
      description:
        "Get standings (leaderboard) for a tournament round. Use when the user asks who is winning, standings, or results. Call get_event_details first for the event—the response lists round IDs; use the latest completed round ID (e.g. final Swiss round) for current/final standings.",
      inputSchema: {
        round_id: z.number().describe("Tournament round ID (e.g. 414976)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page (default: 25)"),
      },
    },
    async (args) => {
      try {
        const response = await fetchTournamentRoundStandings(
          args.round_id,
          args.page,
          args.page_size
        );

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No standings found for round ${args.round_id}. The round may not exist or may not have standings yet.`,
              },
            ],
          };
        }

        const formatted = response.results.map((e, i) =>
          formatStandingEntry(e, (args.page - 1) * args.page_size + i)
        ).join("\n\n");
        const summary = `Round ${args.round_id} standings: ${response.count} shown (page ${args.page} of ${Math.ceil(response.total / args.page_size)}). Total: ${response.total}.\n\n${formatted}`;

        return {
          content: [
            {
              type: "text" as const,
              text: summary,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching round standings: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Round Matches (pairings and results for a round)
  server.registerTool(
    "get_round_matches",
    {
      description:
        "Get match pairings and results for a tournament round. Use when the user asks for pairings, match results, or who played whom. You need the round ID (from get_event_details—the response lists round IDs).",
      inputSchema: {
        round_id: z.number().describe("Tournament round ID (e.g. from get_event_details)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page (default: 25)"),
      },
    },
    async (args) => {
      try {
        const response = await fetchTournamentRoundMatches(
          args.round_id,
          args.page,
          args.page_size
        );

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No matches found for round ${args.round_id}. The round may not exist or pairings may not be published yet.`,
              },
            ],
          };
        }

        const formatted = response.results
          .map((e, i) => formatMatchEntry(e, (args.page - 1) * args.page_size + i))
          .join("\n\n");
        const summary = `Round ${args.round_id} matches: ${response.count} shown (page ${args.page} of ${Math.ceil(response.total / args.page_size)}). Total: ${response.total}.\n\n${formatted}`;

        return {
          content: [
            {
              type: "text" as const,
              text: summary,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching round matches: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Event Standings (tries completed rounds until one returns standings)
  server.registerTool(
    "get_event_standings",
    {
      description:
        "Get tournament standings/results for an event by event ID. Use when the user asks for results, standings, or who won. This tool fetches the event's rounds and returns standings from the latest completed round that has data—so you don't need to look up round IDs. Prefer this over get_tournament_round_standings when the user asks for 'event results' or 'championship results'.",
      inputSchema: {
        event_id: z.number().describe("Event ID (from search_events, search_events_by_city, or get_event_details)"),
        page_size: z.number().default(50).describe("Max standings to return from the round (default: 50)"),
      },
    },
    async (args) => {
      try {
        const event = await fetchEventDetails(args.event_id);
        const phases = event.tournament_phases;
        if (!phases?.length) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Event "${event.name}" (ID: ${args.event_id}) has no tournament rounds. Standings are only available for events with rounds.`,
              },
            ],
          };
        }

        const allRounds: { id: number; round_number: number; phase_name?: string }[] = [];
        for (const phase of phases) {
          if (!phase.rounds?.length) continue;
          for (const r of phase.rounds) {
            allRounds.push({
              id: r.id,
              round_number: r.round_number,
              phase_name: phase.phase_name,
            });
          }
        }
        // Try newest round first (highest round_number) so we return current/latest standings
        allRounds.sort((a, b) => b.round_number - a.round_number);

        if (allRounds.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Event "${event.name}" (ID: ${args.event_id}) has no completed rounds yet. Standings will appear once rounds are finished.`,
              },
            ],
          };
        }

        for (const round of allRounds) {
          try {
            const response = await fetchTournamentRoundStandings(
              round.id,
              1,
              args.page_size
            );
            if (response.results.length > 0) {
              const label = round.phase_name
                ? `Round ${round.round_number} (${round.phase_name})`
                : `Round ${round.round_number}`;
              const formatted = response.results
                .map((e, i) => formatStandingEntry(e, i))
                .join("\n\n");
              const text = `${event.name} (ID: ${args.event_id}) — Standings for ${label} (round ID: ${round.id})\nTotal: ${response.total}\n\n${formatted}`;
              return {
                content: [{ type: "text" as const, text }],
              };
            }
          } catch {
            continue;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `No standings available for event "${event.name}" (ID: ${args.event_id}). The API returned no standings for any of its ${allRounds.length} round(s). The event may still be in progress or standings may not be published yet. Round IDs tried: ${allRounds.map((r) => r.id).join(", ")}.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching event standings: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Event Registrations
  server.registerTool(
    "get_event_registrations",
    {
      description:
        "Get the list of players registered for an event. Use when the user asks who is signed up, the registration list, or how many spots are taken. You need the event ID (from search_events, search_events_by_city, or get_event_details).",
      inputSchema: {
        event_id: z.number().describe("Event ID (e.g. from search or get_event_details)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page (default: 25)"),
      },
    },
    async (args) => {
      try {
        const response = await fetchEventRegistrations(
          args.event_id,
          args.page,
          args.page_size
        );

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No registrations found for event ${args.event_id}. The event may not exist or may not have registrations yet.`,
              },
            ],
          };
        }

        const formatted = response.results
          .map((e, i) => formatRegistrationEntry(e, (args.page - 1) * args.page_size + i))
          .join("\n\n");
        const summary = `Event ${args.event_id} registrations: ${response.count} shown (page ${args.page} of ${Math.ceil(response.total / args.page_size)}). Total: ${response.total}.\n\n${formatted}`;

        return {
          content: [
            {
              type: "text" as const,
              text: summary,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching event registrations: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Search by City Name
  server.registerTool(
    "search_events_by_city",
    {
      description:
        "Search for Disney Lorcana TCG events by city name (geocoded). Use this when the user says a city, e.g. 'events in Seattle' or 'Austin, TX'. For coordinates use search_events instead. Optional: call list_filters for format/category names.",
      inputSchema: {
        city: z.string().describe("City name, ideally with state/country (e.g. 'Detroit, MI' or 'New York, NY')"),
        radius_miles: z.number().default(25).describe("Search radius in miles (default: 25)"),
        start_date: z.string().optional().describe("Only show events starting on or after this date in UTC (YYYY-MM-DD)"),
        end_date: z.string().optional().describe("Only show events starting before this date in UTC (YYYY-MM-DD)"),
        formats: z.array(z.string()).optional().describe("Filter by format names from list_filters (e.g. ['Constructed'])"),
        categories: z.array(z.string()).optional().describe("Filter by category names from list_filters"),
        statuses: z.array(z.enum(STATUSES)).default(["upcoming", "inProgress"]).describe("Include: upcoming, inProgress (live), past, or all (all three)"),
        featured_only: z.boolean().default(false).describe("If true, only featured events"),
        text_search: z.string().optional().describe("Search event names by keyword"),
        store_id: z.number().optional().describe("Limit to events at this store (ID from search_stores)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(args.city)}&format=json&limit=1`;

      try {
        const geoResponse = await fetch(geocodeUrl, {
          headers: {
            "User-Agent": "lorcana-event-finder/1.0",
          },
        });

        if (!geoResponse.ok) {
          throw new Error("Geocoding failed");
        }

        const geoData = (await geoResponse.json()) as Array<{
          lat: string;
          lon: string;
          display_name: string;
        }>;

        if (!geoData || geoData.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not find location: ${args.city}. Try being more specific (e.g., "Detroit, MI, USA").`,
              },
            ],
            isError: true,
          };
        }

        const location = geoData[0];
        const latitude = parseFloat(location.lat);
        const longitude = parseFloat(location.lon);

        const startDateAfter = args.start_date
          ? new Date(args.start_date + "T00:00:00Z").toISOString()
          : (() => {
              const now = new Date();
              return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
            })();

        const params: Record<string, string | string[]> = {
          game_slug: "disney-lorcana",
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          num_miles: args.radius_miles.toString(),
          display_statuses: expandStatusesForApi(args.statuses as string[]),
          page: args.page.toString(),
          page_size: Math.min(args.page_size, 100).toString(),
          start_date_after: startDateAfter,
        };

        if (args.end_date) {
          params.start_date_before = new Date(args.end_date + "T00:00:00Z").toISOString();
        }

        if (args.formats && args.formats.length > 0) {
          const formatIds = resolveFormatIds(args.formats);
          if (formatIds.length > 0) {
            params.gameplay_format_id = formatIds;
          }
        }

        if (args.categories && args.categories.length > 0) {
          const categoryIds = resolveCategoryIds(args.categories);
          if (categoryIds.length > 0) {
            params.event_configuration_template_id = categoryIds;
          }
        }

        if (args.featured_only) {
          params.is_headlining_event = "true";
        }

        if (args.text_search) {
          params.name = args.text_search;
        }

        if (args.store_id) {
          params.store = args.store_id.toString();
        }

        const response = await fetchEvents(params);

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No events found near ${location.display_name} within ${args.radius_miles} miles. Try expanding your search radius or adjusting filters.`,
              },
            ],
          };
        }

        const formattedEvents = response.results.map(formatEvent).join("\n\n---\n\n");
        const summary = `Found ${response.count} event(s) near ${location.display_name}. Showing ${response.results.length} (page ${args.page} of ${Math.ceil(response.count / args.page_size)}).`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${formattedEvents}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Store Events
  server.registerTool(
    "get_store_events",
    {
      description:
        "Get events at a specific store by store ID. Use this after search_stores when the user asks about events at a particular store (e.g. 'events at Game Haven', 'what's coming up at Dragon's Lair'). This is simpler than search_events_by_city when you already have the store ID—no city name or geocoding needed.",
      inputSchema: {
        store_id: z.number().describe("Store ID (from search_stores)"),
        start_date: z.string().optional().describe("Only show events starting on or after this date in UTC (YYYY-MM-DD)"),
        end_date: z.string().optional().describe("Only show events starting before this date in UTC (YYYY-MM-DD)"),
        formats: z.array(z.string()).optional().describe("Filter by format names from list_filters (e.g. ['Constructed'])"),
        categories: z.array(z.string()).optional().describe("Filter by category names from list_filters"),
        statuses: z.array(z.enum(STATUSES)).default(["all"]).describe("Include: upcoming, inProgress (live), past, or all (all three)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      try {
        // API requires lat/long + radius; use global center + Earth-covering radius
        // so store= filter returns that store's events regardless of region
        let storeName = `Store ${args.store_id}`;
        const startDateAfter = args.start_date
          ? new Date(args.start_date + "T00:00:00Z").toISOString()
          : (() => {
              const now = new Date();
              return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
            })();

        const params: Record<string, string | string[]> = {
          game_slug: "disney-lorcana",
          latitude: "0",
          longitude: "0",
          num_miles: "12500", // ~half Earth circumference; covers globe for store-filtered queries
          display_statuses: expandStatusesForApi(args.statuses as string[]),
          store: args.store_id.toString(),
          page: args.page.toString(),
          page_size: Math.min(args.page_size, 100).toString(),
          start_date_after: startDateAfter,
        };

        if (args.end_date) {
          params.start_date_before = new Date(args.end_date + "T00:00:00Z").toISOString();
        }

        if (args.formats && args.formats.length > 0) {
          const formatIds = resolveFormatIds(args.formats);
          if (formatIds.length > 0) {
            params.gameplay_format_id = formatIds;
          }
        }

        if (args.categories && args.categories.length > 0) {
          const categoryIds = resolveCategoryIds(args.categories);
          if (categoryIds.length > 0) {
            params.event_configuration_template_id = categoryIds;
          }
        }

        const response = await fetchEvents(params);

        // Extract store name from the first event if available
        if (response.results.length > 0 && response.results[0].store?.name) {
          storeName = response.results[0].store.name;
        }

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No events found at store ID ${args.store_id}. The store may not have any events matching your criteria, or the store ID may be invalid. Try adjusting date filters or statuses.`,
              },
            ],
          };
        }

        const formattedEvents = response.results.map(formatEvent).join("\n\n---\n\n");
        const summary = `Found ${response.count} event(s) at ${storeName}. Showing ${response.results.length} (page ${args.page} of ${Math.ceil(response.count / args.page_size)}).`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${formattedEvents}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching store events: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Constants for get_player_leaderboard
  const MAX_RADIUS_MILES = 100;
  const MAX_DATE_RANGE_DAYS = 93;
  const MAX_LEADERBOARD_LIMIT = 100;
  const SORT_OPTIONS = ["total_wins", "events_played", "win_rate", "best_placement"] as const;

  /**
   * Stable key for aggregating a player across events.
   * Uses player.id when available (most stable), otherwise falls back to player.best_identifier.
   * Does NOT use user_event_status.best_identifier since that can vary per-event.
   */
  function standingPlayerKey(entry: StandingEntry): string {
    // Prefer player.id as the most stable identifier
    if (entry.player?.id !== undefined && entry.player.id !== null) {
      return `player_id:${entry.player.id}`;
    }
    // Fall back to player.best_identifier (first name + last initial, stable across events)
    return (
      entry.player?.best_identifier ??
      entry.player_name ??
      entry.display_name ??
      entry.username ??
      "—"
    );
  }

  /**
   * Best display name for a player (for output/formatting).
   * Prefers user_event_status.best_identifier (display name/username) when available.
   */
  function standingPlayerDisplayName(entry: StandingEntry): string {
    return (
      entry.user_event_status?.best_identifier ??
      entry.player?.best_identifier ??
      entry.player_name ??
      entry.display_name ??
      entry.username ??
      "—"
    );
  }

  function standingPlacement(entry: StandingEntry, index: number): number {
    return entry.rank ?? entry.placement ?? index + 1;
  }

  /** Get wins and losses from entry; parse record string (e.g. "3-0-1") when numeric fields are missing. */
  function standingWinsLosses(entry: StandingEntry): { wins: number; losses: number } {
    if (entry.wins !== undefined && entry.wins !== null && entry.losses !== undefined && entry.losses !== null) {
      return { wins: Number(entry.wins), losses: Number(entry.losses) };
    }
    return parseRecordToWinsLosses(entry.record ?? entry.match_record);
  }

  // Tool: Get Player Leaderboard (aggregate standings across events)
  server.registerTool(
    "get_player_leaderboard",
    {
      description:
        "Aggregate player performance across multiple past and in-progress events and return a leaderboard. Use when the user asks who had the most wins, best record, or top performers in a region and date range (e.g. 'who had the most wins in set championships in January 2026 in Detroit'). Single tool call replaces many search_events + get_event_standings calls. Call list_filters first to get valid format/category names. Date range limited to 3 months; radius limited to 100 miles.",
      inputSchema: {
        city: z.string().min(1).describe("City name, ideally with state/country (e.g. 'Detroit, MI')"),
        radius_miles: z.number().min(0).max(MAX_RADIUS_MILES).default(50).describe(`Search radius in miles (default: 50, max: ${MAX_RADIUS_MILES})`),
        start_date: z.string().describe("Start of date range (YYYY-MM-DD)"),
        end_date: z.string().describe("End of date range (YYYY-MM-DD); max 3 months from start_date"),
        formats: z.array(z.string()).optional().describe("Filter by format names from list_filters"),
        categories: z.array(z.string()).optional().describe("Filter by category names from list_filters (e.g. 'Set Championship')"),
        sort_by: z.enum(SORT_OPTIONS).default("total_wins").describe("Sort order: total_wins, events_played, win_rate, best_placement"),
        limit: z.number().min(1).max(MAX_LEADERBOARD_LIMIT).default(20).describe(`Number of top players to return (default: 20, max: ${MAX_LEADERBOARD_LIMIT})`),
        min_events: z.number().min(1).default(1).describe("Minimum events a player must have played to appear (default: 1)"),
      },
    },
    async (args) => {
      try {
        const cityTrimmed = args.city.trim();
        if (!cityTrimmed) {
          return {
            content: [{ type: "text" as const, text: "City cannot be empty." }],
            isError: true,
          };
        }

        const start = new Date(args.start_date + "T00:00:00Z");
        const end = new Date(args.end_date + "T00:00:00Z");
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [{ type: "text" as const, text: "Dates must be valid YYYY-MM-DD." }],
            isError: true,
          };
        }
        if (start > end) {
          return {
            content: [{ type: "text" as const, text: "start_date must be on or before end_date." }],
            isError: true,
          };
        }
        const daysDiff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (daysDiff > MAX_DATE_RANGE_DAYS) {
          return {
            content: [{ type: "text" as const, text: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (about 3 months).` }],
            isError: true,
          };
        }

        const radius = Math.min(MAX_RADIUS_MILES, Math.max(0, args.radius_miles));
        const limit = Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, args.limit));
        const minEvents = Math.max(1, args.min_events);

        if (args.formats?.length) {
          try {
            resolveFormatIdsStrict(args.formats);
          } catch (e) {
            return {
              content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
              isError: true,
            };
          }
        }
        if (args.categories?.length) {
          try {
            resolveCategoryIdsStrict(args.categories);
          } catch (e) {
            return {
              content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
              isError: true,
            };
          }
        }

        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityTrimmed)}&format=json&limit=1`;
        const geoResponse = await fetch(geocodeUrl, {
          headers: { "User-Agent": "lorcana-event-finder/1.0" },
        });
        if (!geoResponse.ok) {
          return {
            content: [{ type: "text" as const, text: `Could not geocode city: ${cityTrimmed}` }],
            isError: true,
          };
        }
        const geoData = (await geoResponse.json()) as Array<{ lat: string; lon: string; display_name: string }>;
        if (!geoData?.length) {
          return {
            content: [{ type: "text" as const, text: `Could not find location: ${cityTrimmed}. Try being more specific (e.g. "Detroit, MI, USA").` }],
            isError: true,
          };
        }
        const latitude = parseFloat(geoData[0].lat);
        const longitude = parseFloat(geoData[0].lon);
        const displayCity = geoData[0].display_name;

        const params: Record<string, string | string[]> = {
          game_slug: "disney-lorcana",
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          num_miles: radius.toString(),
          display_statuses: ["past", "inProgress"],
          start_date_after: start.toISOString(),
          start_date_before: end.toISOString(),
          page: "1",
          page_size: "100",
        };
        if (args.formats?.length) {
          params.gameplay_format_id = resolveFormatIdsStrict(args.formats);
        }
        if (args.categories?.length) {
          params.event_configuration_template_id = resolveCategoryIdsStrict(args.categories);
        }

        const allEvents: Array<{ id: number; name: string; start_datetime: string }> = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          params.page = page.toString();
          const response = await fetchEvents(params);
          for (const e of response.results) {
            allEvents.push({ id: e.id, name: e.name, start_datetime: e.start_datetime });
          }
          hasMore = response.results.length === 100 && response.count > allEvents.length;
          page += 1;
        }

        if (allEvents.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No past or in-progress events found near ${displayCity} for ${args.start_date} – ${args.end_date} with the given filters. Try a larger radius or different dates.`,
              },
            ],
          };
        }

        const eventStandings = await fetchAllEventStandings(allEvents.map((e) => e.id));
        const agg = new Map<
          string,
          {
            displayName: string;
            hasUserEventStatus: boolean;
            wins: number;
            losses: number;
            eventsPlayed: number;
            placements: number[];
          }
        >();

        for (const { event, standings } of eventStandings) {
          for (let i = 0; i < standings.length; i++) {
            const entry = standings[i];
            const key = standingPlayerKey(entry);
            if (key === "—") continue;
            const displayName = standingPlayerDisplayName(entry);
            const hasUserEventStatus = entry.user_event_status?.best_identifier !== undefined;
            const placement = standingPlacement(entry, i);
            const { wins, losses } = standingWinsLosses(entry);
            let rec = agg.get(key);
            if (!rec) {
              rec = {
                displayName,
                hasUserEventStatus,
                wins: 0,
                losses: 0,
                eventsPlayed: 0,
                placements: [],
              };
              agg.set(key, rec);
            } else if (hasUserEventStatus && !rec.hasUserEventStatus) {
              // Prefer display name from user_event_status when we find one
              rec.displayName = displayName;
              rec.hasUserEventStatus = true;
            }
            rec.wins += wins;
            rec.losses += losses;
            rec.eventsPlayed += 1;
            rec.placements.push(placement);
          }
        }

        let players: PlayerStats[] = Array.from(agg.values())
          .filter((r) => r.eventsPlayed >= minEvents)
          .map((r) => ({
            playerName: r.displayName,
            totalWins: r.wins,
            totalLosses: r.losses,
            eventsPlayed: r.eventsPlayed,
            bestPlacement: Math.min(...r.placements),
            firstPlaceFinishes: r.placements.filter((p) => p === 1).length,
            placements: r.placements,
          }));

        const sortBy = args.sort_by;
        if (sortBy === "total_wins") {
          players.sort((a, b) => b.totalWins - a.totalWins);
        } else if (sortBy === "events_played") {
          players.sort((a, b) => b.eventsPlayed - a.eventsPlayed);
        } else if (sortBy === "win_rate") {
          players.sort((a, b) => {
            const rateA = a.totalWins + a.totalLosses > 0 ? a.totalWins / (a.totalWins + a.totalLosses) : 0;
            const rateB = b.totalWins + b.totalLosses > 0 ? b.totalWins / (b.totalWins + b.totalLosses) : 0;
            return rateB - rateA;
          });
        } else {
          players.sort((a, b) => a.bestPlacement - b.bestPlacement);
        }
        players = players.slice(0, limit);

        const sortLabels: Record<typeof sortBy, string> = {
          total_wins: "TOTAL WINS",
          events_played: "EVENTS PLAYED",
          win_rate: "WIN RATE",
          best_placement: "BEST PLACEMENT",
        };

        const result: LeaderboardResult = {
          players,
          eventsAnalyzed: eventStandings.length,
          eventsIncluded: eventStandings.map(({ event }) => ({
            id: event.id,
            name: event.name,
            startDate: event.start_datetime,
          })),
          dateRange: { start: args.start_date, end: args.end_date },
          filters: {
            city: displayCity,
            categories: args.categories?.length ? args.categories : undefined,
            formats: args.formats?.length ? args.formats : undefined,
          },
        };

        const text = formatLeaderboard(result, sortLabels[sortBy]);
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error building leaderboard: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Player Leaderboard by Store (aggregate standings at a specific store)
  server.registerTool(
    "get_player_leaderboard_by_store",
    {
      description:
        "Aggregate player performance across past and in-progress events at a specific store and return a leaderboard. Use when the user asks who had the most wins or top performers at a particular store (e.g. 'leaderboard at Game Haven', 'best players at store 123'). Get store ID from search_stores. Date range limited to 3 months.",
      inputSchema: {
        store_id: z.number().describe("Store ID (from search_stores)"),
        start_date: z.string().describe("Start of date range (YYYY-MM-DD)"),
        end_date: z.string().describe("End of date range (YYYY-MM-DD); max 3 months from start_date"),
        formats: z.array(z.string()).optional().describe("Filter by format names from list_filters"),
        categories: z.array(z.string()).optional().describe("Filter by category names from list_filters (e.g. 'Set Championship')"),
        sort_by: z.enum(SORT_OPTIONS).default("total_wins").describe("Sort order: total_wins, events_played, win_rate, best_placement"),
        limit: z.number().min(1).max(MAX_LEADERBOARD_LIMIT).default(20).describe(`Number of top players to return (default: 20, max: ${MAX_LEADERBOARD_LIMIT})`),
        min_events: z.number().min(1).default(1).describe("Minimum events a player must have played to appear (default: 1)"),
      },
    },
    async (args) => {
      try {
        const start = new Date(args.start_date + "T00:00:00Z");
        const end = new Date(args.end_date + "T00:00:00Z");
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return {
            content: [{ type: "text" as const, text: "Dates must be valid YYYY-MM-DD." }],
            isError: true,
          };
        }
        if (start > end) {
          return {
            content: [{ type: "text" as const, text: "start_date must be on or before end_date." }],
            isError: true,
          };
        }
        const daysDiff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        if (daysDiff > MAX_DATE_RANGE_DAYS) {
          return {
            content: [{ type: "text" as const, text: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days (about 3 months).` }],
            isError: true,
          };
        }

        const limit = Math.min(MAX_LEADERBOARD_LIMIT, Math.max(1, args.limit));
        const minEvents = Math.max(1, args.min_events);

        if (args.formats?.length) {
          try {
            resolveFormatIdsStrict(args.formats);
          } catch (e) {
            return {
              content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
              isError: true,
            };
          }
        }
        if (args.categories?.length) {
          try {
            resolveCategoryIdsStrict(args.categories);
          } catch (e) {
            return {
              content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }],
              isError: true,
            };
          }
        }

        const params: Record<string, string | string[]> = {
          game_slug: "disney-lorcana",
          latitude: "0",
          longitude: "0",
          num_miles: "12500",
          display_statuses: ["past", "inProgress"],
          store: args.store_id.toString(),
          start_date_after: start.toISOString(),
          start_date_before: end.toISOString(),
          page: "1",
          page_size: "100",
        };
        if (args.formats?.length) {
          params.gameplay_format_id = resolveFormatIdsStrict(args.formats);
        }
        if (args.categories?.length) {
          params.event_configuration_template_id = resolveCategoryIdsStrict(args.categories);
        }

        const allEvents: Array<{ id: number; name: string; start_datetime: string }> = [];
        let page = 1;
        let hasMore = true;
        let storeName: string | undefined;
        while (hasMore) {
          params.page = page.toString();
          const response = await fetchEvents(params);
          for (const e of response.results) {
            allEvents.push({ id: e.id, name: e.name, start_datetime: e.start_datetime });
            if (!storeName && e.store?.name) storeName = e.store.name;
          }
          hasMore = response.results.length === 100 && response.count > allEvents.length;
          page += 1;
        }

        if (allEvents.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No past or in-progress events found at store ID ${args.store_id} for ${args.start_date} – ${args.end_date} with the given filters. Try different dates or filters.`,
              },
            ],
          };
        }

        const eventStandings = await fetchAllEventStandings(allEvents.map((e) => e.id));
        const agg = new Map<
          string,
          {
            displayName: string;
            hasUserEventStatus: boolean;
            wins: number;
            losses: number;
            eventsPlayed: number;
            placements: number[];
          }
        >();

        for (const { event, standings } of eventStandings) {
          for (let i = 0; i < standings.length; i++) {
            const entry = standings[i];
            const key = standingPlayerKey(entry);
            if (key === "—") continue;
            const displayName = standingPlayerDisplayName(entry);
            const hasUserEventStatus = entry.user_event_status?.best_identifier !== undefined;
            const placement = standingPlacement(entry, i);
            const { wins, losses } = standingWinsLosses(entry);
            let rec = agg.get(key);
            if (!rec) {
              rec = {
                displayName,
                hasUserEventStatus,
                wins: 0,
                losses: 0,
                eventsPlayed: 0,
                placements: [],
              };
              agg.set(key, rec);
            } else if (hasUserEventStatus && !rec.hasUserEventStatus) {
              // Prefer display name from user_event_status when we find one
              rec.displayName = displayName;
              rec.hasUserEventStatus = true;
            }
            rec.wins += wins;
            rec.losses += losses;
            rec.eventsPlayed += 1;
            rec.placements.push(placement);
          }
        }

        let players: PlayerStats[] = Array.from(agg.values())
          .filter((r) => r.eventsPlayed >= minEvents)
          .map((r) => ({
            playerName: r.displayName,
            totalWins: r.wins,
            totalLosses: r.losses,
            eventsPlayed: r.eventsPlayed,
            bestPlacement: Math.min(...r.placements),
            firstPlaceFinishes: r.placements.filter((p) => p === 1).length,
            placements: r.placements,
          }));

        const sortBy = args.sort_by;
        if (sortBy === "total_wins") {
          players.sort((a, b) => b.totalWins - a.totalWins);
        } else if (sortBy === "events_played") {
          players.sort((a, b) => b.eventsPlayed - a.eventsPlayed);
        } else if (sortBy === "win_rate") {
          players.sort((a, b) => {
            const rateA = a.totalWins + a.totalLosses > 0 ? a.totalWins / (a.totalWins + a.totalLosses) : 0;
            const rateB = b.totalWins + b.totalLosses > 0 ? b.totalWins / (b.totalWins + b.totalLosses) : 0;
            return rateB - rateA;
          });
        } else {
          players.sort((a, b) => a.bestPlacement - b.bestPlacement);
        }
        players = players.slice(0, limit);

        const sortLabels: Record<typeof sortBy, string> = {
          total_wins: "TOTAL WINS",
          events_played: "EVENTS PLAYED",
          win_rate: "WIN RATE",
          best_placement: "BEST PLACEMENT",
        };

        const result: LeaderboardResult = {
          players,
          eventsAnalyzed: eventStandings.length,
          eventsIncluded: eventStandings.map(({ event }) => ({
            id: event.id,
            name: event.name,
            startDate: event.start_datetime,
          })),
          dateRange: { start: args.start_date, end: args.end_date },
          filters: {
            store: storeName ?? `Store ${args.store_id}`,
            categories: args.categories?.length ? args.categories : undefined,
            formats: args.formats?.length ? args.formats : undefined,
          },
        };

        const text = formatLeaderboard(result, sortLabels[sortBy]);
        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error building leaderboard: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
