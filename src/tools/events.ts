/**
 * MCP tools for event search, details, registrations, and tournament standings.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  fetchEventDetails,
  fetchEventRegistrations,
  fetchEvents,
  fetchTournamentRoundStandings,
  resolveCategoryIds,
  resolveFormatIds,
  STATUSES,
} from "../lib/api.js";
import {
  formatEvent,
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
        start_date: z.string().optional().describe("Only show events starting after this date (YYYY-MM-DD)"),
        formats: z.array(z.string()).optional().describe("Filter by format names; get exact names from list_filters (e.g. ['Constructed'])"),
        categories: z.array(z.string()).optional().describe("Filter by category names; get exact names from list_filters"),
        statuses: z.array(z.enum(STATUSES)).default(["upcoming", "inProgress"]).describe("Include: upcoming, inProgress (live), past"),
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

      params.display_statuses = args.statuses as string[];

      if (args.start_date) {
        params.start_date_after = new Date(args.start_date).toISOString();
      } else {
        params.start_date_after = new Date().toISOString();
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
        "Get full details for one Disney Lorcana event by ID. Use after search_events or search_events_by_city when the user asks for more info about a specific event, or when you have an event ID (e.g. from a previous search).",
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
        "Get standings (leaderboard) for a tournament round. Use when the user asks who is winning, standings, or results for a round. You need the round ID (sometimes in event context or from get_event_details).",
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
        start_date: z.string().optional().describe("Only events starting after this date (YYYY-MM-DD)"),
        formats: z.array(z.string()).optional().describe("Filter by format names from list_filters (e.g. ['Constructed'])"),
        categories: z.array(z.string()).optional().describe("Filter by category names from list_filters"),
        statuses: z.array(z.enum(STATUSES)).default(["upcoming", "inProgress"]).describe("Include: upcoming, inProgress, past"),
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

        const params: Record<string, string | string[]> = {
          game_slug: "disney-lorcana",
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          num_miles: args.radius_miles.toString(),
          display_statuses: args.statuses as string[],
          page: args.page.toString(),
          page_size: Math.min(args.page_size, 100).toString(),
          start_date_after: args.start_date
            ? new Date(args.start_date).toISOString()
            : new Date().toISOString(),
        };

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
}
