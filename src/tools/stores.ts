/**
 * MCP tools for store search (by name, location, or city).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchStoreDetails, fetchStores, geocodeAddress } from "../lib/api.js";
import { formatStore } from "../lib/formatters.js";

const STORE_TYPES = [
  "physicalRetailer",
  "onlineRetailer",
  "physicalAndOnlineRetailer",
  "organizedPlay",
  "partner",
] as const;

export function registerStoreTools(server: McpServer): void {
  // Tool: Search Stores
  server.registerTool(
    "search_stores",
    {
      description:
        "Search for game stores that host Disney Lorcana events. Use when the user asks for stores, venues, or places to play. Pass search (name) and/or latitude+longitude+radius_miles; you can pass both. No location = first page of all stores. Optional store_type narrows results (e.g. organizedPlay).",
      inputSchema: {
        search: z.string().optional().describe("Search by store name (e.g. 'game' or store name)"),
        latitude: z.number().optional().describe("Latitude for location search (use with longitude and radius_miles)"),
        longitude: z.number().optional().describe("Longitude for location search (use with latitude and radius_miles)"),
        radius_miles: z.number().default(25).describe("Radius in miles when using lat/long (default: 25)"),
        store_type: z
          .enum(STORE_TYPES)
          .optional()
          .describe("Optional store type filter: physicalRetailer, onlineRetailer, physicalAndOnlineRetailer, organizedPlay, partner"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      const params: Record<string, string> = {
        page: args.page.toString(),
        page_size: Math.min(args.page_size, 100).toString(),
      };

      if (args.search) {
        params.search = args.search;
      }

      if (args.latitude !== undefined && args.longitude !== undefined) {
        params.latitude = args.latitude.toString();
        params.longitude = args.longitude.toString();
        params.num_miles = args.radius_miles.toString();
      }
      if (args.store_type) {
        params.game_store_type = args.store_type;
      }

      try {
        const response = await fetchStores(params);

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No stores found matching your criteria. Try a different search term or location.",
              },
            ],
          };
        }

        const formattedStores = response.results.map(formatStore).join("\n\n---\n\n");
        const summary = `Found ${response.count} store(s). Showing ${response.results.length} (page ${args.page}).`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${formattedStores}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching stores: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Get Store Details
  server.registerTool(
    "get_store_details",
    {
      description:
        "Get full profile details for a store by game_store_id (UUID). Use when the user asks for one store's detailed info (bio, links, contact, types). The game_store_id is included in search_stores results.",
      inputSchema: {
        game_store_id: z.string().describe("Game store ID (UUID) from search_stores, e.g. 6cb0ce43-309a-4759-a5c3-142a44b08614"),
      },
    },
    async (args) => {
      try {
        const store = await fetchStoreDetails(args.game_store_id);
        return {
          content: [
            {
              type: "text" as const,
              text: formatStore(store),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching store details: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Search Stores by City
  server.registerTool(
    "search_stores_by_city",
    {
      description:
        "Search for game stores that host Disney Lorcana events by city name (geocoded). Use when the user says a city, e.g. 'stores in Seattle' or 'where to play in Austin'. For coordinates use search_stores with latitude/longitude.",
      inputSchema: {
        city: z.string().describe("City name, ideally with state/country (e.g. 'Detroit, MI' or 'New York, NY')"),
        radius_miles: z.number().default(25).describe("Radius in miles (default: 25)"),
        store_type: z
          .enum(STORE_TYPES)
          .optional()
          .describe("Optional store type filter: physicalRetailer, onlineRetailer, physicalAndOnlineRetailer, organizedPlay, partner"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      try {
        const location = await geocodeAddress(args.city);
        if (!location) {
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

        const latitude = location.address.lat;
        const longitude = location.address.lng;

        const params: Record<string, string> = {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          num_miles: args.radius_miles.toString(),
          page: args.page.toString(),
          page_size: Math.min(args.page_size, 100).toString(),
        };
        if (args.store_type) {
          params.game_store_type = args.store_type;
        }

        const response = await fetchStores(params);

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No stores found near ${location.address.formattedAddress} within ${args.radius_miles} miles.`,
              },
            ],
          };
        }

        const formattedStores = response.results.map(formatStore).join("\n\n---\n\n");
        const totalPages = Math.ceil(response.count / args.page_size);
        const summary = `Found ${response.count} store(s) near ${location.address.formattedAddress}. Showing ${response.results.length} (page ${args.page} of ${totalPages}).`;

        return {
          content: [
            {
              type: "text" as const,
              text: `${summary}\n\n${formattedStores}`,
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
