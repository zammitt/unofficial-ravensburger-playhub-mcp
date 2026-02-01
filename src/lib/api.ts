/**
 * API client for Ravensburger Play (events, stores, formats, categories, standings, registrations).
 */

import type {
  Event,
  EventCategory,
  EventsResponse,
  GameplayFormat,
  GameStore,
  MatchesResponse,
  RegistrationsResponse,
  StandingEntry,
  StandingsResponse,
  StoresResponse,
} from "./types.js";

const API_BASE = "https://api.cloudflare.ravensburgerplay.com/hydraproxy/api/v2";

/** Event statuses supported by the API. */
export const STATUSES = ["upcoming", "inProgress", "past"] as const;

// Dynamic lookup maps - populated at startup and refreshed by list_filters
let FORMAT_MAP: Map<string, string> = new Map(); // name -> id
let CATEGORY_MAP: Map<string, string> = new Map(); // name -> id

/** Load and cache formats and categories from the API (called at server startup). */
export async function loadFilterOptions(): Promise<void> {
  try {
    const [formats, categories] = await Promise.all([
      fetchGameplayFormats(),
      fetchCategories(),
    ]);
    updateFilterMaps(formats, categories);
    console.error(`Loaded ${FORMAT_MAP.size} formats and ${CATEGORY_MAP.size} categories from API`);
  } catch (error) {
    console.error("Warning: Failed to load filter options from API:", error);
  }
}

/** Update the in-memory format/category maps (e.g. after list_filters refresh). */
export function updateFilterMaps(formats: GameplayFormat[], categories: EventCategory[]): void {
  FORMAT_MAP = new Map(formats.map((f) => [f.name, f.id]));
  CATEGORY_MAP = new Map(categories.map((c) => [c.name, c.id]));
}

export async function fetchGameplayFormats(): Promise<GameplayFormat[]> {
  const url = `${API_BASE}/gameplay-formats/?game_slug=disney-lorcana`;
  const response = await fetch(url, {
    headers: { Referer: "https://tcg.ravensburgerplay.com/" },
  });
  if (!response.ok) throw new Error("Failed to fetch formats");
  return response.json();
}

export async function fetchCategories(): Promise<EventCategory[]> {
  const url = `${API_BASE}/event-configuration-templates/?game_slug=disney-lorcana`;
  const response = await fetch(url, {
    headers: { Referer: "https://tcg.ravensburgerplay.com/" },
  });
  if (!response.ok) throw new Error("Failed to fetch categories");
  return response.json();
}

export async function fetchEvents(params: Record<string, string | string[]>): Promise<EventsResponse> {
  const url = new URL(`${API_BASE}/events/`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else if (value !== undefined && value !== "") {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function fetchEventDetails(eventId: number): Promise<Event> {
  const url = `${API_BASE}/events/${eventId}/`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function fetchEventRegistrations(
  eventId: number,
  page: number = 1,
  pageSize: number = 25
): Promise<RegistrationsResponse> {
  const url = new URL(`${API_BASE}/events/${eventId}/registrations/`);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("page_size", pageSize.toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function fetchTournamentRoundStandings(
  roundId: number,
  page: number = 1,
  pageSize: number = 25
): Promise<StandingsResponse> {
  const url = new URL(`${API_BASE}/tournament-rounds/${roundId}/standings/paginated/`);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("page_size", pageSize.toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function fetchTournamentRoundMatches(
  roundId: number,
  page: number = 1,
  pageSize: number = 25
): Promise<MatchesResponse> {
  const url = new URL(`${API_BASE}/tournament-rounds/${roundId}/matches/paginated/`);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("page_size", pageSize.toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

export async function fetchStores(params: Record<string, string>): Promise<StoresResponse> {
  const url = new URL(`${API_BASE}/game-stores/`);
  url.searchParams.append("game_id", "1");

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://tcg.ravensburgerplay.com/",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

/** Resolve format display names to API IDs. */
export function resolveFormatIds(formatNames: string[]): string[] {
  const ids: string[] = [];
  for (const name of formatNames) {
    const id = FORMAT_MAP.get(name);
    if (id) ids.push(id);
    else console.error(`Warning: Unknown format "${name}"`);
  }
  return ids;
}

/** Resolve category display names to API IDs. */
export function resolveCategoryIds(categoryNames: string[]): string[] {
  const ids: string[] = [];
  for (const name of categoryNames) {
    const id = CATEGORY_MAP.get(name);
    if (id) ids.push(id);
    else console.error(`Warning: Unknown category "${name}"`);
  }
  return ids;
}

/** Reverse lookup: category template ID to display name. */
export function getCategoryName(templateId: string): string {
  for (const [name, id] of CATEGORY_MAP.entries()) {
    if (id === templateId) return name;
  }
  return templateId;
}
