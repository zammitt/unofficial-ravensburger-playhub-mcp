/**
 * Integration tests: spawn the Lorcana Event Finder MCP server and run each tool
 * with one or more call variations to ensure the server and all tools work end-to-end.
 *
 * Run after build: npm run build && npm test
 * Requires network (Ravensburger API, Nominatim geocoding).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client";
// StdioClientTransport is not re-exported from the client entry; load from SDK dist.
import { StdioClientTransport } from "../../node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// When run from dist/test/, go up to repo root
const projectRoot = resolve(__dirname, "..", "..");

const EXPECTED_TOOL_NAMES = [
  "list_capabilities",
  "list_filters",
  "search_events",
  "get_event_details",
  "get_tournament_round_standings",
  "get_round_matches",
  "get_event_standings",
  "get_player_leaderboard",
  "get_player_leaderboard_by_store",
  "get_event_registrations",
  "search_events_by_city",
  "get_store_events",
  "search_stores",
  "search_stores_by_city",
] as const;

type ToolName = (typeof EXPECTED_TOOL_NAMES)[number];

const parsedIntegrationTimeoutMs = Number.parseInt(process.env.INTEGRATION_TEST_TIMEOUT_MS ?? "", 10);
const INTEGRATION_TIMEOUT_MS = Number.isFinite(parsedIntegrationTimeoutMs) && parsedIntegrationTimeoutMs > 0
  ? parsedIntegrationTimeoutMs
  : 180_000;

describe("MCP server integration – all tools and call variations", { timeout: INTEGRATION_TIMEOUT_MS }, () => {
  let client: InstanceType<typeof Client>;
  let transport: InstanceType<typeof StdioClientTransport>;

  before(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [resolve(projectRoot, "dist/index.js")],
      cwd: projectRoot,
      stderr: "pipe",
    });
    client = new Client(
      { name: "mcp-tools-integration-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(transport);
  });

  after(async () => {
    await transport.close();
  });

  it("lists all expected tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    const expected = [...EXPECTED_TOOL_NAMES].sort();
    assert.deepStrictEqual(
      names,
      expected,
      `Expected tools ${expected.join(", ")}; got ${names.join(", ")}`
    );
  });

  async function callTool(name: ToolName, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(result, "callTool should return a result");
    if ("content" in result && Array.isArray(result.content)) {
      const textPart = result.content.find((c) => c.type === "text" && "text" in c);
      return {
        content: result.content,
        text: textPart && "text" in textPart ? (textPart.text as string) : "",
        isError: "isError" in result ? !!result.isError : false,
      };
    }
    return { content: result, text: "", isError: false };
  }

  it("list_capabilities – no args", async () => {
    const { text, isError } = await callTool("list_capabilities", {});
    assert.ok(!isError, `list_capabilities should not error: ${text}`);
    assert.ok(text.includes("search_events"), "capabilities should mention search_events");
    assert.ok(text.includes("search_events_by_city"), "capabilities should mention search_events_by_city");
    assert.ok(text.includes("get_event_details") || text.includes("get_event"), "capabilities should mention event details");
    assert.ok(text.includes("get_player_leaderboard"), "capabilities should mention get_player_leaderboard");
    assert.ok(text.includes("list_filters"), "capabilities should mention list_filters");
  });

  it("list_filters – no args", async () => {
    const { text, isError } = await callTool("list_filters", {});
    assert.ok(!isError, `list_filters should not error: ${text}`);
    assert.ok(text.includes("Formats") || text.includes("formats"), "list_filters should include formats");
    assert.ok(text.includes("Categories") || text.includes("categories"), "list_filters should include categories");
    assert.ok(text.includes("Example") || text.includes("formats"), "list_filters should include usage example or param names");
  });

  it("search_events – required only", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
    });
    assert.ok(!isError, `search_events should not error: ${text}`);
    assert.ok(typeof text === "string" && text.length > 0, "should return non-empty text");
  });

  it("search_events – with optional params", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      radius_miles: 10,
      page: 1,
      page_size: 5,
      statuses: ["upcoming", "inProgress"],
      featured_only: false,
    });
    assert.ok(!isError, `search_events (optional) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events – with text_search", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      radius_miles: 50,
      text_search: "Lorcana",
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_events (text_search) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events – with store_id", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      radius_miles: 100,
      store_id: 1,
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_events (store_id) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events – with start_date", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      start_date: "2025-01-01",
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_events (start_date) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events – invalid date returns error", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      start_date: "2026-13-40",
    });
    assert.ok(isError, "should error for invalid date");
    assert.ok(text.includes("YYYY-MM-DD"), "message should mention date format");
  });

  it("search_events – invalid format returns error", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      formats: ["NonExistentFormatName"],
    });
    assert.ok(isError, "should error for unknown format");
    assert.ok(text.includes("Unknown format") || text.includes("list_filters"), "message should mention format or list_filters");
  });

  it("get_event_details – valid-looking id", async () => {
    const { text, isError } = await callTool("get_event_details", { event_id: 1 });
    // API may return 404 for id=1; server still returns content (possibly error message)
    assert.ok(typeof text === "string" && text.length > 0, "should return some content");
  });

  it("get_tournament_round_standings – required only", async () => {
    const { text, isError } = await callTool("get_tournament_round_standings", {
      round_id: 414976,
    });
    assert.ok(!isError, `get_tournament_round_standings should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_tournament_round_standings – with pagination", async () => {
    const { text, isError } = await callTool("get_tournament_round_standings", {
      round_id: 414976,
      page: 1,
      page_size: 10,
    });
    assert.ok(!isError, `get_tournament_round_standings (pagination) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_round_matches – required only", async () => {
    const { text, isError } = await callTool("get_round_matches", { round_id: 414976 });
    assert.ok(!isError, `get_round_matches should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_event_standings – event with rounds", async () => {
    const { text, isError } = await callTool("get_event_standings", {
      event_id: 362750,
      page_size: 25,
    });
    assert.ok(!isError, `get_event_standings should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
    // Event 362750 has standings; response should include standings or a clear "no standings" message
    assert.ok(
      text.includes("362750") || text.includes("Standings") || text.includes("No standings"),
      "response should mention event or standings"
    );
  });

  it("get_event_registrations – required only", async () => {
    const { text, isError } = await callTool("get_event_registrations", {
      event_id: 333450,
    });
    assert.ok(!isError, `get_event_registrations should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_event_registrations – with pagination", async () => {
    const { text, isError } = await callTool("get_event_registrations", {
      event_id: 333450,
      page: 1,
      page_size: 10,
    });
    assert.ok(!isError, `get_event_registrations (pagination) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_player_leaderboard – invalid date range returns error", async () => {
    const { text, isError } = await callTool("get_player_leaderboard", {
      city: "Detroit, MI",
      start_date: "2026-02-01",
      end_date: "2026-01-01",
    });
    assert.ok(isError, "should error when start_date is after end_date");
    assert.ok(text.includes("start_date") || text.includes("end_date") || text.includes("before"), "message should mention dates");
  });

  it("get_player_leaderboard – valid params returns content", async () => {
    const { text, isError } = await callTool("get_player_leaderboard", {
      city: "Detroit, MI",
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      limit: 5,
    });
    assert.ok(!isError, `get_player_leaderboard should not error: ${text}`);
    assert.ok(typeof text === "string" && text.length > 0, "should return text");
    assert.ok(text.includes("Leaderboard") || text.includes("events") || text.includes("No past events"), "should mention leaderboard or events");
  });

  it("get_player_leaderboard_by_store – invalid date range returns error", async () => {
    const { text, isError } = await callTool("get_player_leaderboard_by_store", {
      store_id: 4622,
      start_date: "2026-02-01",
      end_date: "2026-01-01",
    });
    assert.ok(isError, "should error when start_date is after end_date");
    assert.ok(text.includes("start_date") || text.includes("end_date") || text.includes("before"), "message should mention dates");
  });

  it("get_player_leaderboard_by_store – valid params returns content", async () => {
    const { text, isError } = await callTool("get_player_leaderboard_by_store", {
      store_id: 4622,
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      limit: 5,
    });
    assert.ok(!isError, `get_player_leaderboard_by_store should not error: ${text}`);
    assert.ok(typeof text === "string" && text.length > 0, "should return text");
    assert.ok(
      text.includes("Leaderboard") || text.includes("events") || text.includes("No past events") || text.includes("Store"),
      "should mention leaderboard, events, or store"
    );
  });

  it("get_player_leaderboard_by_store – invalid format returns error", async () => {
    const { text, isError } = await callTool("get_player_leaderboard_by_store", {
      store_id: 4622,
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      formats: ["NonExistentFormatName"],
    });
    assert.ok(isError, "should error for unknown format");
    assert.ok(text.includes("Unknown format") || text.includes("list_filters"), "message should mention format or list_filters");
  });

  it("search_events_by_city – required only", async () => {
    const { text, isError } = await callTool("search_events_by_city", {
      city: "Detroit, MI",
    });
    assert.ok(!isError, `search_events_by_city should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events_by_city – with optional params", async () => {
    const { text, isError } = await callTool("search_events_by_city", {
      city: "New York, NY",
      radius_miles: 15,
      page: 1,
    });
    assert.ok(!isError, `search_events_by_city (optional) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events_by_city – with page_size", async () => {
    const { text, isError } = await callTool("search_events_by_city", {
      city: "Detroit, MI",
      radius_miles: 25,
      page: 1,
      page_size: 10,
    });
    assert.ok(!isError, `search_events_by_city (page_size) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events_by_city – invalid date returns error", async () => {
    const { text, isError } = await callTool("search_events_by_city", {
      city: "Detroit, MI",
      start_date: "bad-date",
    });
    assert.ok(isError, "should error for invalid date");
    assert.ok(text.includes("YYYY-MM-DD"), "message should mention date format");
  });

  it("get_store_events – required only", async () => {
    // Use a known store ID for testing
    const { text, isError } = await callTool("get_store_events", {
      store_id: 4622,
    });
    assert.ok(!isError, `get_store_events should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_store_events – with optional params", async () => {
    const { text, isError } = await callTool("get_store_events", {
      store_id: 4622,
      statuses: ["past"],
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `get_store_events (optional) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("get_store_events – invalid category returns error", async () => {
    const { text, isError } = await callTool("get_store_events", {
      store_id: 4622,
      categories: ["NonExistentCategoryName"],
    });
    assert.ok(isError, "should error for unknown category");
    assert.ok(text.includes("Unknown category") || text.includes("list_filters"), "message should mention category or list_filters");
  });

  it("search_stores – no args (list first page)", async () => {
    const { text, isError } = await callTool("search_stores", {
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_stores should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_stores – by name", async () => {
    const { text, isError } = await callTool("search_stores", {
      search: "game",
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_stores (search) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_stores – by location", async () => {
    const { text, isError } = await callTool("search_stores", {
      latitude: 42.33,
      longitude: -83.05,
      radius_miles: 10,
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_stores (location) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_stores_by_city – required only", async () => {
    const { text, isError } = await callTool("search_stores_by_city", {
      city: "Detroit, MI",
    });
    assert.ok(!isError, `search_stores_by_city should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_stores_by_city – with optional params", async () => {
    const { text, isError } = await callTool("search_stores_by_city", {
      city: "Chicago, IL",
      radius_miles: 20,
      page: 1,
    });
    assert.ok(!isError, `search_stores_by_city (optional) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_stores_by_city – with page_size", async () => {
    const { text, isError } = await callTool("search_stores_by_city", {
      city: "Detroit, MI",
      radius_miles: 25,
      page: 1,
      page_size: 10,
    });
    assert.ok(!isError, `search_stores_by_city (page_size) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });

  it("search_events – with status past", async () => {
    const { text, isError } = await callTool("search_events", {
      latitude: 42.33,
      longitude: -83.05,
      radius_miles: 100,
      statuses: ["past"],
      page: 1,
      page_size: 5,
    });
    assert.ok(!isError, `search_events (status past) should not error: ${text}`);
    assert.ok(typeof text === "string", "should return text");
  });
});
