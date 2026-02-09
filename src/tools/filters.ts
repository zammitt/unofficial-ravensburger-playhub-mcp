/**
 * MCP tools for capabilities discovery and metadata/filter lookup.
 */

import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  autocompletePlaces,
  fetchCardById,
  fetchCategories,
  fetchEventQuickFilters,
  fetchGameDetails,
  fetchGames,
  fetchGameplayFormats,
  geocodePlaceId,
  searchCardsQuick,
  updateFilterMaps,
} from "../lib/api.js";

const CAPABILITIES_TEXT = `# Lorcana Event Finder – Tool Guide

Use this to choose the right tool. All tools return plain text.

| Tool | When to use |
|------|-------------|
| **list_filters** | User wants to filter events by format/category; call first to get exact names for \`formats\` / \`categories\`. |
| **list_quick_filters** | User asks for site preset filters like "Locals this week" or "Drivable Set Championships". |
| **list_games** | List games currently available on Ravensburger Play Hub. |
| **get_game_details** | Inspect one game's metadata/theme/publisher configuration by slug. |
| **search_cards** | Search card names and get card IDs (for deck/decklist/card lookup requests). |
| **get_card_details** | Fetch one card's full metadata by card ID. |
| **search_places** | Autocomplete location/place suggestions and place IDs for precise city/address lookup. |
| **get_place_coordinates** | Resolve a place ID to coordinates and normalized address. |
| **search_events** | You have latitude and longitude (e.g. from map/device). |
| **search_events_by_city** | User says a city name, e.g. "events in Seattle". |
| **get_store_events** | Get events at a specific store (numeric \`store_id\` from search_stores). |
| **get_event_details** | Get full info for one event when you already have event ID. |
| **get_event_standings** | Event results/standings by event ID (auto-finds best round). |
| **get_player_leaderboard** | Top players across many events in region/date range. |
| **get_event_registrations** | Registration list for an event by event ID. |
| **get_tournament_round_standings** | Standings for a specific round ID. |
| **get_round_matches** | Pairings/match results for a specific round ID. |
| **search_stores** | Search stores by name and/or location; optional \`store_type\` filter. |
| **get_store_details** | Store profile details by \`game_store_id\` (UUID from search_stores). |
| **search_stores_by_city** | Find stores near a city name; optional \`store_type\` filter. |

**Dates:** For "today's events", pass \`start_date: "YYYY-MM-DD"\` with today's date. If omitted, search starts from today (UTC).
`;

export function registerFilterTools(server: McpServer): void {
  server.registerTool(
    "list_capabilities",
    {
      description:
        "List all tools and when to use each. Call this first if you are unsure which tool to use.",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: CAPABILITIES_TEXT }],
    })
  );

  server.registerTool(
    "list_filters",
    {
      description:
        "List format and category names for event search filters. Use exact names from this output in search_events/search_events_by_city/get_store_events.",
      inputSchema: {},
    },
    async () => {
      try {
        const [formats, categories] = await Promise.all([
          fetchGameplayFormats(),
          fetchCategories(),
        ]);

        updateFilterMaps(formats, categories);

        const formatList = formats.map((f) => `- ${f.name}${f.description ? ` - ${f.description}` : ""}`).join("\n");
        const categoryList = categories.map((c) => `- ${c.name}`).join("\n");

        const filterInfo = `# Event Search Filters (use exact names in parameters)

## Formats (use in \`formats\` array)
${formatList}

## Categories (use in \`categories\` array)
${categoryList}

## Statuses (use in \`statuses\` array)
- upcoming - Not started yet
- inProgress - Live now
- past - Finished
- all - All three (upcoming, inProgress, past); expands when calling the API

## Example
To filter by format and category in search_events/search_events_by_city/get_store_events, pass arrays of exact names:
\`formats: ["Core Constructed"]\`, \`categories: ["Winterspell - Set Championship"]\`.
`;

        return {
          content: [
            {
              type: "text" as const,
              text: filterInfo,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching filter options: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_quick_filters",
    {
      description:
        "List preconfigured quick event filters used by the website UI (e.g. Locals this week).",
      inputSchema: {
        game_slug: z.string().default("disney-lorcana").describe("Game slug (default: disney-lorcana)"),
      },
    },
    async (args) => {
      try {
        const quickFilters = await fetchEventQuickFilters(args.game_slug);
        if (quickFilters.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No quick filters available for game slug "${args.game_slug}".`,
              },
            ],
          };
        }

        const lines = quickFilters.map((qf) => {
          const statuses = Array.isArray(qf.filter_config?.displayStatuses)
            ? qf.filter_config.displayStatuses.join(", ")
            : "none";
          const radius = qf.filter_config?.numMiles ?? "n/a";
          const category = qf.filter_config?.eventConfigurationTemplateId ?? "none";
          return [
            `- ${qf.name} (ID: ${qf.id})`,
            `  statuses: ${statuses}`,
            `  radius_miles: ${radius}`,
            `  event_configuration_template_id: ${category}`,
          ].join("\n");
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Quick filters for ${args.game_slug}:\n\n${lines.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching quick filters: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_games",
    {
      description:
        "List games currently available on Ravensburger Play Hub, including slug and ID.",
      inputSchema: {},
    },
    async () => {
      try {
        const games = await fetchGames();
        if (games.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No games returned by API." }],
          };
        }
        const lines = games.map((g) => `- ${g.name} (slug: ${g.slug}, id: ${g.id})`);
        return {
          content: [{ type: "text" as const, text: `Available games:\n\n${lines.join("\n")}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching games: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_game_details",
    {
      description:
        "Get detailed metadata for one game by slug (e.g. disney-lorcana).",
      inputSchema: {
        game_slug: z.string().describe("Game slug (e.g. disney-lorcana)"),
      },
    },
    async (args) => {
      try {
        const game = await fetchGameDetails(args.game_slug);
        const lines: string[] = [
          `Game: ${game.name} (slug: ${game.slug}, id: ${game.id})`,
        ];
        if ("publisher" in game && game.publisher && typeof game.publisher === "object") {
          const publisher = game.publisher as { name?: string };
          if (publisher.name) lines.push(`Publisher: ${publisher.name}`);
        }
        const keys = Object.keys(game).sort();
        lines.push(`Fields: ${keys.join(", ")}`);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching game details: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "search_cards",
    {
      description:
        "Search cards by name text and return card IDs plus summary metadata.",
      inputSchema: {
        query: z.string().min(1).describe("Card name text to search (e.g. Elsa)"),
        game_id: z.number().default(1).describe("Game ID (default: 1 for Disney Lorcana)"),
        max_results: z.number().min(1).max(50).default(20).describe("Maximum cards to show (default: 20, max: 50)"),
      },
    },
    async (args) => {
      try {
        const response = await searchCardsQuick(args.query, args.game_id);
        if (!response.results?.length) {
          return {
            content: [{ type: "text" as const, text: `No cards found matching "${args.query}".` }],
          };
        }

        const shown = response.results.slice(0, args.max_results);
        const lines = shown.map((card, index) => {
          const name = card.display_name ?? card.name;
          const setName = card.set_name ? ` | set: ${card.set_name}` : "";
          const rarity = card.rarity ? ` | rarity: ${card.rarity}` : "";
          const ink = card.ink_type ? ` | ink: ${card.ink_type}` : "";
          return `${index + 1}. ${name} (Card ID: ${card.id}${setName}${rarity}${ink})`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${response.count} card(s) matching "${args.query}". Showing ${shown.length}.\n\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error searching cards: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_card_details",
    {
      description:
        "Get full details for a single card by card ID (UUID).",
      inputSchema: {
        card_id: z.string().describe("Card ID (UUID) from search_cards"),
      },
    },
    async (args) => {
      try {
        const card = await fetchCardById(args.card_id);
        const lines: string[] = [
          `Card: ${card.display_name ?? card.name}`,
          `Card ID: ${card.id}`,
        ];
        if (card.type_line) lines.push(`Type: ${card.type_line}`);
        if (card.set_name) lines.push(`Set: ${card.set_name}`);
        if (card.collector_number) lines.push(`Collector Number: ${card.collector_number}`);
        if (card.rarity) lines.push(`Rarity: ${card.rarity}`);
        if (card.ink_type) lines.push(`Ink Type: ${card.ink_type}`);
        if (typeof card.ink_cost === "number") lines.push(`Ink Cost: ${card.ink_cost}`);
        if (typeof card.strength === "number") lines.push(`Strength: ${card.strength}`);
        if (typeof card.willpower === "number") lines.push(`Willpower: ${card.willpower}`);
        if (typeof card.lore_value === "number") lines.push(`Lore: ${card.lore_value}`);
        if (card.rules_text) lines.push(`Rules: ${card.rules_text}`);
        if (card.flavor_text) lines.push(`Flavor: ${card.flavor_text}`);
        if (card.image_url) lines.push(`Image: ${card.image_url}`);

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error fetching card details: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "search_places",
    {
      description:
        "Autocomplete places and return place IDs from Play Hub's location API. Use this when a city/address is ambiguous and you want a precise place_id for follow-up geocoding.",
      inputSchema: {
        query: z.string().min(2).describe("Partial place text, city, or address (e.g. Detroit, MI)"),
        session_token: z.string().optional().describe("Optional client session token; if omitted, one is generated"),
        max_results: z.number().min(1).max(20).default(10).describe("Maximum place suggestions to return (default: 10, max: 20)"),
      },
    },
    async (args) => {
      try {
        const sessionToken = args.session_token?.trim() || randomUUID();
        const response = await autocompletePlaces(args.query, sessionToken);
        const suggestions = response.suggestions ?? [];

        if (suggestions.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No place suggestions found for "${args.query}".` }],
          };
        }

        const lines = suggestions.slice(0, args.max_results).map((item, index) => {
          const prediction = item.placePrediction;
          const placeId = prediction?.placeId ?? "unknown";
          const mainText =
            prediction?.structuredFormat?.mainText?.text ??
            prediction?.text?.text ??
            prediction?.place ??
            "Unknown place";
          const secondaryText = prediction?.structuredFormat?.secondaryText?.text;
          const label = secondaryText ? `${mainText}, ${secondaryText}` : mainText;
          return `${index + 1}. ${label} (place_id: ${placeId})`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Place suggestions for "${args.query}" (session_token: ${sessionToken}):\n\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error searching places: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_place_coordinates",
    {
      description:
        "Resolve a place_id to normalized address and coordinates (lat/lng). Use place_id values returned by search_places.",
      inputSchema: {
        place_id: z.string().min(1).describe("Place ID from search_places"),
      },
    },
    async (args) => {
      try {
        const geocoded = await geocodePlaceId(args.place_id);
        if (!geocoded) {
          return {
            content: [{ type: "text" as const, text: `No geocode result found for place_id "${args.place_id}".` }],
            isError: true,
          };
        }

        const lines: string[] = [
          `Address: ${geocoded.address.formattedAddress}`,
          `Latitude: ${geocoded.address.lat}`,
          `Longitude: ${geocoded.address.lng}`,
        ];
        if (geocoded.placeId) lines.push(`Place ID: ${geocoded.placeId}`);
        if (geocoded.types?.length) lines.push(`Types: ${geocoded.types.join(", ")}`);
        if (geocoded.bounds?.northeast && geocoded.bounds?.southwest) {
          lines.push(
            `Bounds: NE(${geocoded.bounds.northeast.lat}, ${geocoded.bounds.northeast.lng}) SW(${geocoded.bounds.southwest.lat}, ${geocoded.bounds.southwest.lng})`
          );
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: `Error geocoding place_id: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
