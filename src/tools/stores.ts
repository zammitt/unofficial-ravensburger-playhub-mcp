/**
 * MCP tools for store search (by name, location, or city).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchStores } from "../lib/api.js";
import { fetchWithRetry } from "../lib/http.js";
import { formatStore } from "../lib/formatters.js";

export function registerStoreTools(server: McpServer): void {
  // Tool: Search Stores
  server.registerTool(
    "search_stores",
    {
      description:
        "Search for game stores that host Disney Lorcana events. Use when the user asks for stores, venues, or places to play. Pass search (name) and/or latitude+longitude+radius_miles; you can pass both. No location = first page of all stores.",
      inputSchema: {
        search: z.string().optional().describe("Search by store name (e.g. 'game' or store name)"),
        latitude: z.number().optional().describe("Latitude for location search (use with longitude and radius_miles)"),
        longitude: z.number().optional().describe("Longitude for location search (use with latitude and radius_miles)"),
        radius_miles: z.number().default(25).describe("Radius in miles when using lat/long (default: 25)"),
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

  // Tool: Search Stores by City
  server.registerTool(
    "search_stores_by_city",
    {
      description:
        "Search for game stores that host Disney Lorcana events by city name (geocoded). Use when the user says a city, e.g. 'stores in Seattle' or 'where to play in Austin'. For coordinates use search_stores with latitude/longitude.",
      inputSchema: {
        city: z.string().describe("City name, ideally with state/country (e.g. 'Detroit, MI' or 'New York, NY')"),
        radius_miles: z.number().default(25).describe("Radius in miles (default: 25)"),
        page: z.number().default(1).describe("Page number (default: 1)"),
        page_size: z.number().default(25).describe("Results per page, max 100 (default: 25)"),
      },
    },
    async (args) => {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(args.city)}&format=json&limit=1`;

      try {
        const geoResponse = await fetchWithRetry(geocodeUrl, {
          headers: { "User-Agent": "lorcana-event-finder/1.0" },
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

        const params: Record<string, string> = {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          num_miles: args.radius_miles.toString(),
          page: args.page.toString(),
          page_size: Math.min(args.page_size, 100).toString(),
        };

        const response = await fetchStores(params);

        if (response.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No stores found near ${location.display_name} within ${args.radius_miles} miles.`,
              },
            ],
          };
        }

        const formattedStores = response.results.map(formatStore).join("\n\n---\n\n");
        const totalPages = Math.ceil(response.count / args.page_size);
        const summary = `Found ${response.count} store(s) near ${location.display_name}. Showing ${response.results.length} (page ${args.page} of ${totalPages}).`;

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
