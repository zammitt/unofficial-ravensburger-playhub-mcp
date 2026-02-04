import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  expandStatusesForApi,
  loadFilterOptions,
  updateFilterMaps,
  resolveFormatIds,
  resolveFormatIdsStrict,
  resolveCategoryIds,
  resolveCategoryIdsStrict,
  getCategoryName,
  fetchGameplayFormats,
  fetchCategories,
  fetchEvents,
  fetchEventDetails,
  fetchEventRegistrations,
  fetchTournamentRoundMatches,
  fetchTournamentRoundStandings,
  fetchAllRoundStandings,
  fetchStores,
  clearCaches,
  getCacheStats,
} from "../lib/api.js";
import type { GameplayFormat, EventCategory } from "../lib/types.js";

const sampleFormats: GameplayFormat[] = [
  { id: "fmt-1", name: "Constructed" },
  { id: "fmt-2", name: "Draft" },
];
const sampleCategories: EventCategory[] = [
  { id: "cat-1", name: "League" },
  { id: "cat-2", name: "Tournament" },
];

describe("expandStatusesForApi", () => {
  it('expands "all" to upcoming, inProgress, past', () => {
    assert.deepStrictEqual(expandStatusesForApi(["all"]), ["upcoming", "inProgress", "past"]);
  });

  it("passes through statuses when all is not present", () => {
    assert.deepStrictEqual(expandStatusesForApi(["upcoming", "inProgress"]), ["upcoming", "inProgress"]);
    assert.deepStrictEqual(expandStatusesForApi(["past"]), ["past"]);
  });

  it("when all is present with others, returns all three API statuses", () => {
    assert.deepStrictEqual(expandStatusesForApi(["all", "past"]), ["upcoming", "inProgress", "past"]);
  });

  it("when input is empty, returns all three API statuses (avoids sending [] to API)", () => {
    assert.deepStrictEqual(expandStatusesForApi([]), ["upcoming", "inProgress", "past"]);
  });
});

describe("api – filter maps and resolution", () => {
  beforeEach(() => {
    updateFilterMaps(sampleFormats, sampleCategories);
  });

  it("updateFilterMaps sets format and category maps", () => {
    const formatIds = resolveFormatIds(["Constructed", "Draft"]);
    assert.deepStrictEqual(formatIds, ["fmt-1", "fmt-2"]);
    const categoryIds = resolveCategoryIds(["League", "Tournament"]);
    assert.deepStrictEqual(categoryIds, ["cat-1", "cat-2"]);
  });

  it("resolveFormatIds returns only known names and skips unknown", () => {
    const stub = () => {};
    const orig = console.error;
    console.error = stub;
    try {
      const ids = resolveFormatIds(["Constructed", "UnknownFormat", "Draft"]);
      assert.deepStrictEqual(ids, ["fmt-1", "fmt-2"]);
    } finally {
      console.error = orig;
    }
  });

  it("resolveFormatIds returns empty for empty input", () => {
    assert.deepStrictEqual(resolveFormatIds([]), []);
  });

  it("resolveCategoryIds returns only known names and skips unknown", () => {
    const stub = () => {};
    const orig = console.error;
    console.error = stub;
    try {
      const ids = resolveCategoryIds(["League", "UnknownCat", "Tournament"]);
      assert.deepStrictEqual(ids, ["cat-1", "cat-2"]);
    } finally {
      console.error = orig;
    }
  });

  it("resolveCategoryIds returns empty for empty input", () => {
    assert.deepStrictEqual(resolveCategoryIds([]), []);
  });

  it("getCategoryName returns name for known template id", () => {
    assert.strictEqual(getCategoryName("cat-1"), "League");
    assert.strictEqual(getCategoryName("cat-2"), "Tournament");
  });

  it("getCategoryName returns templateId when not in map", () => {
    assert.strictEqual(getCategoryName("unknown-id"), "unknown-id");
  });

  it("resolveFormatIdsStrict returns ids for all known names", () => {
    const ids = resolveFormatIdsStrict(["Constructed", "Draft"]);
    assert.deepStrictEqual(ids, ["fmt-1", "fmt-2"]);
  });

  it("resolveFormatIdsStrict throws for unknown format names", () => {
    assert.throws(
      () => resolveFormatIdsStrict(["Constructed", "UnknownFormat"]),
      /Unknown format.*Use list_filters.*UnknownFormat/
    );
  });

  it("resolveCategoryIdsStrict returns ids for all known names", () => {
    const ids = resolveCategoryIdsStrict(["League", "Tournament"]);
    assert.deepStrictEqual(ids, ["cat-1", "cat-2"]);
  });

  it("resolveCategoryIdsStrict throws for unknown category names", () => {
    assert.throws(
      () => resolveCategoryIdsStrict(["League", "Set Championship"]),
      /Unknown category.*Use list_filters.*Set Championship/
    );
  });
});

describe("api – fetch with mocked global fetch", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchGameplayFormats returns json on ok response", async () => {
    const data = [{ id: "1", name: "Constructed" }];
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchGameplayFormats();
    assert.deepStrictEqual(result, data);
  });

  it("fetchGameplayFormats throws on non-ok response", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(fetchGameplayFormats, /Failed to fetch formats/);
  });

  it("fetchCategories returns json on ok response", async () => {
    const data = [{ id: "1", name: "League" }];
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchCategories();
    assert.deepStrictEqual(result, data);
  });

  it("fetchCategories throws on non-ok response", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(fetchCategories, /Failed to fetch categories/);
  });

  it("fetchEvents builds url with params and returns json", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      assert.ok(u.includes("game_slug"));
      return new Response(JSON.stringify(data), { status: 200 });
    };
    const result = await fetchEvents({ game_slug: "disney-lorcana", latitude: "42", longitude: "-83" });
    assert.strictEqual(result.count, 0);
    assert.deepStrictEqual(result.results, []);
  });

  it("fetchEvents appends array params as multiple query params", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    let capturedUrl = "";
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(JSON.stringify(data), { status: 200 });
    };
    await fetchEvents({ display_statuses: ["upcoming", "inProgress"] });
    assert.ok(capturedUrl.includes("display_statuses=upcoming"));
    assert.ok(capturedUrl.includes("display_statuses=inProgress"));
  });

  it("fetchEvents throws with response text on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response("API error body", { status: 400 });
    await assert.rejects(
      () => fetchEvents({ game_slug: "x" }),
      /API request failed.*API error body/
    );
  });

  it("fetchEventDetails returns event on ok", async () => {
    clearCaches();
    const event = { id: 1, name: "Test Event", start_datetime: "2025-01-01T12:00:00Z" };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(event), { status: 200 });
    const result = await fetchEventDetails(1);
    assert.strictEqual(result.id, 1);
    assert.strictEqual(result.name, "Test Event");
  });

  it("fetchEventDetails throws on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response("Not found", { status: 404 });
    await assert.rejects(
      () => fetchEventDetails(999),
      /API request failed/
    );
  });

  it("fetchEventRegistrations builds url with page and page_size", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 10, current_page_number: 2, next_page_number: null, previous_page_number: null };
    let capturedUrl = "";
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(JSON.stringify(data), { status: 200 });
    };
    await fetchEventRegistrations(1, 2, 10);
    assert.ok(capturedUrl.includes("page=2"));
    assert.ok(capturedUrl.includes("page_size=10"));
  });

  it("fetchEventRegistrations throws on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(
      () => fetchEventRegistrations(1),
      /API request failed/
    );
  });

  it("fetchTournamentRoundStandings returns json on ok", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchTournamentRoundStandings(100, 1, 25);
    assert.strictEqual(result.count, 0);
  });

  it("fetchTournamentRoundStandings throws on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(
      () => fetchTournamentRoundStandings(100),
      /API request failed/
    );
  });

  it("fetchTournamentRoundMatches returns json on ok", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchTournamentRoundMatches(100, 1, 25);
    assert.strictEqual(result.count, 0);
  });

  it("fetchTournamentRoundMatches throws on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(
      () => fetchTournamentRoundMatches(100),
      /API request failed/
    );
  });

  it("fetchStores builds url with game_id and params", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    let capturedUrl = "";
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(JSON.stringify(data), { status: 200 });
    };
    await fetchStores({ search: "game" });
    assert.ok(capturedUrl.includes("game_id=1"));
    assert.ok(capturedUrl.includes("search=game"));
  });

  it("fetchStores skips empty string params", async () => {
    const data = { count: 0, total: 0, results: [], page_size: 25, current_page_number: 1, next_page_number: null, previous_page_number: null };
    let capturedUrl = "";
    globalThis.fetch = async (input: RequestInfo | URL) => {
      capturedUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return new Response(JSON.stringify(data), { status: 200 });
    };
    await fetchStores({ search: "", other: "value" });
    assert.ok(!capturedUrl.includes("search="));
    assert.ok(capturedUrl.includes("other=value"));
  });

  it("fetchStores throws on non-ok", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.rejects(() => fetchStores({}), /API request failed/);
  });
});

describe("api – loadFilterOptions", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalConsoleError = console.error;
    console.error = () => {}; // suppress expected "Loaded..." / "Failed to load..." messages
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });

  it("loads formats and categories and updates maps on success", async () => {
    const formats = [{ id: "lf1", name: "Constructed" }];
    const categories = [{ id: "lc1", name: "League" }];
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (u.includes("gameplay-formats")) return new Response(JSON.stringify(formats), { status: 200 });
      if (u.includes("event-configuration-templates")) return new Response(JSON.stringify(categories), { status: 200 });
      return new Response("", { status: 404 });
    };
    await loadFilterOptions();
    assert.deepStrictEqual(resolveFormatIds(["Constructed"]), ["lf1"]);
    assert.deepStrictEqual(resolveCategoryIds(["League"]), ["lc1"]);
    assert.strictEqual(getCategoryName("lc1"), "League");
  });

  it("does not throw when fetch fails (logs warning)", async () => {
    globalThis.fetch = async (_input: RequestInfo | URL) => new Response("error", { status: 500 });
    await assert.doesNotReject(loadFilterOptions());
  });
});

describe("api – completed event cache", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    clearCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchEventDetails caches past events and returns cache on second call", async () => {
    const pastEvent = {
      id: 42,
      name: "Past Championship",
      start_datetime: "2025-01-01T12:00:00Z",
      display_status: "past",
    };
    let fetchCallCount = 0;
    globalThis.fetch = async (_input: RequestInfo | URL) => {
      fetchCallCount++;
      return new Response(JSON.stringify(pastEvent), { status: 200 });
    };
    const first = await fetchEventDetails(42);
    assert.strictEqual(first.id, 42);
    assert.strictEqual(fetchCallCount, 1);
    const second = await fetchEventDetails(42);
    assert.strictEqual(second.id, 42);
    assert.strictEqual(fetchCallCount, 1, "second call should hit cache");
  });

  it("fetchEventDetails does not cache upcoming events", async () => {
    const upcomingEvent = {
      id: 99,
      name: "Upcoming Event",
      start_datetime: "2026-06-01T12:00:00Z",
      display_status: "upcoming",
    };
    let fetchCallCount = 0;
    globalThis.fetch = async (_input: RequestInfo | URL) => {
      fetchCallCount++;
      return new Response(JSON.stringify(upcomingEvent), { status: 200 });
    };
    await fetchEventDetails(99);
    await fetchEventDetails(99);
    assert.strictEqual(fetchCallCount, 2, "upcoming events should not be cached");
  });

  it("getCacheStats returns sizes for event and round standings caches", async () => {
    assert.deepStrictEqual(getCacheStats(), { eventCacheSize: 0, roundStandingsCacheSize: 0 });
    const pastEvent = { id: 1, name: "E", start_datetime: "2025-01-01Z", display_status: "past" };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(pastEvent), { status: 200 });
    await fetchEventDetails(1);
    assert.strictEqual(getCacheStats().eventCacheSize, 1);
    assert.strictEqual(getCacheStats().roundStandingsCacheSize, 0);
  });

  it("clearCaches clears both caches", async () => {
    const pastEvent = { id: 1, name: "E", start_datetime: "2025-01-01Z", display_status: "past" };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(pastEvent), { status: 200 });
    await fetchEventDetails(1);
    assert.strictEqual(getCacheStats().eventCacheSize, 1);
    clearCaches();
    assert.deepStrictEqual(getCacheStats(), { eventCacheSize: 0, roundStandingsCacheSize: 0 });
  });

  it("fetchAllRoundStandings with isPastEvent caches and returns cache on second call", async () => {
    const standingsPage = {
      count: 2,
      total: 2,
      page_size: 100,
      current_page_number: 1,
      next_page_number: null,
      previous_page_number: null,
      results: [
        { rank: 1, player_name: "Alice", wins: 3, losses: 0 },
        { rank: 2, player_name: "Bob", wins: 2, losses: 1 },
      ],
    };
    let fetchCallCount = 0;
    globalThis.fetch = async (_input: RequestInfo | URL) => {
      fetchCallCount++;
      return new Response(JSON.stringify(standingsPage), { status: 200 });
    };
    const first = await fetchAllRoundStandings(100, true);
    assert.strictEqual(first.length, 2);
    assert.strictEqual(fetchCallCount, 1);
    const second = await fetchAllRoundStandings(100, true);
    assert.strictEqual(second.length, 2);
    assert.strictEqual(fetchCallCount, 1, "second call should hit cache");
  });

  it("fetchAllRoundStandings with isPastEvent false does not cache", async () => {
    const standingsPage = {
      count: 1,
      total: 1,
      page_size: 100,
      current_page_number: 1,
      next_page_number: null,
      previous_page_number: null,
      results: [{ rank: 1, player_name: "X", wins: 1, losses: 0 }],
    };
    let fetchCallCount = 0;
    globalThis.fetch = async (_input: RequestInfo | URL) => {
      fetchCallCount++;
      return new Response(JSON.stringify(standingsPage), { status: 200 });
    };
    await fetchAllRoundStandings(200, false);
    await fetchAllRoundStandings(200, false);
    assert.strictEqual(fetchCallCount, 2, "isPastEvent false should not cache");
  });
});
