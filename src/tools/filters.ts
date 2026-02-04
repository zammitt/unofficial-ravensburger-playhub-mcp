/**
 * MCP tools for listing filters (formats, categories) and server capabilities (for LLM discovery).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchCategories, fetchGameplayFormats, updateFilterMaps } from "../lib/api.js";

const CAPABILITIES_TEXT = `# Lorcana Event Finder – Tool Guide

Use this to choose the right tool. All tools return plain text.

| Tool | When to use |
|------|-------------|
| **list_filters** | User wants to filter events by format (e.g. Constructed) or category; call first to get exact names for \`formats\` / \`categories\` parameters. |
| **search_events** | You have latitude and longitude (e.g. from a map or device). |
| **search_events_by_city** | User says a city name, e.g. "events in Seattle" or "Austin, TX". |
| **get_store_events** | User asks about events at a specific store (e.g. "events at Game Haven", "what's at Dragon's Lair"). Use after search_stores—takes store_id directly, no city needed. |
| **get_event_details** | User asks for more info about a specific event; you have an event ID (from search). |
| **get_event_standings** | User asks for **results, standings, or who won** for an event. Use event ID only; this tool finds rounds and returns standings automatically. Prefer over get_tournament_round_standings for "championship results" or "event results". |
| **get_player_leaderboard** | User asks who had the **most wins**, **top performers**, or **best record** across **multiple events** in a region and date range (e.g. "who had the most wins in set championships in January 2026 in Detroit"). Single call; no need to search events then call get_event_standings per event. Date range max 3 months; radius max 100 miles. |
| **get_event_registrations** | User asks who is signed up or the registration list; you need event ID. |
| **get_tournament_round_standings** | Standings for a specific round when you already have a round ID (e.g. from get_event_details). |
| **get_round_matches** | Pairings and match results for a round; you need round ID (from get_event_details). Use when the user asks who played whom or for match results. |
| **search_stores** | User asks for stores, venues, or places to play; optional: name (\`search\`) and/or location (lat/long + \`radius_miles\`). |
| **search_stores_by_city** | User says a city for stores, e.g. "stores in Seattle". |

**Dates:** For "today's events", pass \`start_date: "YYYY-MM-DD"\` with **today's date** (correct year) so events that already started today are included. If you omit start_date, results are from the start of today (UTC).

**Typical flows:**
- "events near Seattle" → \`search_events_by_city(city: "Seattle, WA")\`
- "events at Game Haven" → \`search_stores(search: "Game Haven")\` to get store_id, then \`get_store_events(store_id: ...)\`
- "how did X do at the Dragon's Lair event" → \`search_stores(search: "Dragon's Lair")\`, then \`get_store_events(store_id: ..., statuses: ["past"])\`, then \`get_event_standings(event_id)\`
- "who had the most wins in set championships in January 2026 in Detroit" → \`get_player_leaderboard(city: "Detroit, MI", start_date: "2026-01-01", end_date: "2026-01-31", categories: ["Set Championship"], sort_by: "total_wins")\`
`;

export function registerFilterTools(server: McpServer): void {
  // Tool: List Capabilities (for LLM discovery)
  server.registerTool(
    "list_capabilities",
    {
      description:
        "List all tools and when to use each. Call this first if you are unsure which tool to use (e.g. search_events vs search_events_by_city, or how to get event IDs).",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: CAPABILITIES_TEXT }],
    })
  );

  // Tool: List Available Filters
  server.registerTool(
    "list_filters",
    {
      description:
        "List format and category names you can use when searching events. Call before search_events or search_events_by_city if the user wants to filter by format (e.g. Constructed) or category. Use the exact names shown in the formats and categories array parameters.",
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
To filter by format and category in search_events or search_events_by_city, pass arrays of the exact names above, e.g. \`formats: ["Constructed"]\`, \`categories: ["League"]\`.

## Other optional parameters
- featured_only (boolean): Only featured events
- text_search (string): Search event names
- store_id (number): Limit to one store (IDs from search_stores)
- radius_miles (number): Search radius, default 25
- start_date (string): YYYY-MM-DD, events starting after this date
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
}
