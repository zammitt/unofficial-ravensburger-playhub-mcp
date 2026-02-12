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
  fetchEventQuickFilters,
  fetchEvents,
  fetchEventDetails,
  fetchEventRegistrations,
  fetchStoreDetails,
  fetchTournamentRoundMatches,
  fetchTournamentRoundStandings,
  fetchAllRoundStandings,
  fetchStores,
  autocompletePlaces,
  geocodeAddress,
  geocodePlaceId,
  searchCardsQuick,
  fetchGames,
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

  it("fetchEventQuickFilters returns json on ok response", async () => {
    const data = [{ id: 1, name: "Locals this week", filter_config: { displayStatuses: ["upcoming"] } }];
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchEventQuickFilters();
    assert.deepStrictEqual(result, data);
  });

  it("fetchGames returns json on ok response", async () => {
    const data = [{ id: 1, slug: "disney-lorcana", name: "Disney Lorcana" }];
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchGames();
    assert.deepStrictEqual(result, data);
  });

  it("geocodeAddress returns parsed data payload", async () => {
    const data = {
      data: {
        address: {
          formattedAddress: "Seattle, WA, USA",
          lat: 47.6061,
          lng: -122.3328,
        },
      },
      error: null,
    };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await geocodeAddress("Seattle, WA");
    assert.ok(result);
    assert.strictEqual(result?.address.formattedAddress, "Seattle, WA, USA");
    assert.strictEqual(result?.address.lat, 47.6061);
  });

  it("geocodePlaceId returns parsed data payload", async () => {
    const data = {
      data: {
        address: {
          formattedAddress: "Detroit, MI, USA",
          lat: 42.3314,
          lng: -83.0458,
        },
        placeId: "ChIJdR3LEAhO4okR0dr0K8z3aM0",
      },
      error: null,
    };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await geocodePlaceId("ChIJdR3LEAhO4okR0dr0K8z3aM0");
    assert.ok(result);
    assert.strictEqual(result?.placeId, "ChIJdR3LEAhO4okR0dr0K8z3aM0");
    assert.strictEqual(result?.address.lat, 42.3314);
  });

  it("autocompletePlaces returns suggestions payload", async () => {
    const data = {
      suggestions: [
        {
          placePrediction: {
            placeId: "ChIJdR3LEAhO4okR0dr0K8z3aM0",
            structuredFormat: {
              mainText: { text: "Detroit" },
              secondaryText: { text: "MI, USA" },
            },
          },
        },
      ],
    };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await autocompletePlaces("detroit", "session-token");
    assert.strictEqual(result.suggestions.length, 1);
    assert.strictEqual(result.suggestions[0]?.placePrediction?.placeId, "ChIJdR3LEAhO4okR0dr0K8z3aM0");
  });

  it("searchCardsQuick sends POST body and returns json", async () => {
    const data = { count: 1, results: [{ id: "card-1", name: "Elsa" }] };
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      assert.ok(u.includes("deckbuilder/cards/quick-search"));
      assert.strictEqual(init?.method, "POST");
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      assert.strictEqual(body.query, "elsa");
      assert.strictEqual(body.game_id, 1);
      return new Response(JSON.stringify(data), { status: 200 });
    };
    const result = await searchCardsQuick("elsa", 1);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.results[0].id, "card-1");
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
      () => fetchTournamentRoundStandings(101),
      /API request failed/
    );
  });

  it("fetchTournamentRoundStandings falls back to non-paginated standings when paginated is empty", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (u.includes("/standings/paginated/")) {
        return new Response(
          JSON.stringify({
            count: 0,
            total: 0,
            results: [],
            page_size: 25,
            current_page_number: 1,
            next_page_number: null,
            previous_page_number: null,
          }),
          { status: 200 }
        );
      }
      if (u.includes("/standings/")) {
        return new Response(
          JSON.stringify({
            standings: [
              { rank: 1, player_name: "Alice", wins: 3, losses: 0 },
              { rank: 2, player_name: "Bob", wins: 2, losses: 1 },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response("error", { status: 404 });
    };
    const result = await fetchTournamentRoundStandings(102, 1, 25);
    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.results.length, 2);
    assert.strictEqual(result.results[0].player_name, "Alice");
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

  it("fetchStoreDetails returns json on ok response", async () => {
    const data = { id: "store-uuid", store: { id: 1, name: "Game Haven" }, store_types: [], store_types_pretty: [] };
    globalThis.fetch = async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify(data), { status: 200 });
    const result = await fetchStoreDetails("store-uuid");
    assert.strictEqual(result.id, "store-uuid");
    assert.strictEqual(result.store.name, "Game Haven");
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

