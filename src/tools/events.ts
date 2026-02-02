/**
 * MCP tools for event search, details, registrations, and tournament standings.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  expandStatusesForApi,
  fetchEventDetails,
  fetchEventRegistrations,
  fetchEvents,
  fetchTournamentRoundMatches,
  fetchTournamentRoundStandings,
  resolveCategoryIds,
  resolveFormatIds,
  STATUSES,
} from "../lib/api.js";
import {
  formatEvent,
  formatMatchEntry,
  formatRegistrationEntry,
  formatStandingEntry,
} from "../lib/formatters.js";

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
}
