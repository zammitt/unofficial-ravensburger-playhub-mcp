/**
 * Shared types for the Lorcana Event Finder MCP server (API responses and domain models).
 */

export interface GameplayFormat {
  id: string;
  name: string;
  description?: string;
}

export interface EventCategory {
  id: string;
  name: string;
}

export interface Store {
  id: number;
  name: string;
  full_address?: string;
  city?: string | null;
  state?: string | null;
  country?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  email?: string;
  phone_number?: string;
  street_address?: string;
  zipcode?: string;
  bio?: string | null;
  discord_url?: string;
  facebook_url?: string;
  twitter_handle?: string;
  instagram_handle?: string;
}

export interface GameStore {
  id: string;
  store: Store;
  store_types: string[];
  store_types_pretty: string[];
}

export interface StoresResponse {
  count: number;
  total: number;
  page_size: number;
  current_page_number: number;
  next_page_number: number | null;
  previous_page_number: number | null;
  results: GameStore[];
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string | null;
  full_address?: string;
  latitude?: number;
  longitude?: number;
  gameplay_format?: GameplayFormat | null;
  event_configuration_template?: string;
  event_format?: string;
  event_type?: string;
  cost_in_cents?: number;
  currency?: string;
  capacity?: number;
  registered_user_count?: number;
  starting_player_count?: number;
  display_status?: string;
  is_headlining_event?: boolean;
  event_is_online?: boolean;
  distance_in_miles?: number;
  store?: Store;
  url?: string | null;
  settings?: {
    event_lifecycle_status?: string;
  };
}

export interface EventsResponse {
  count: number;
  total: number;
  page_size: number;
  current_page_number: number;
  next_page_number: number | null;
  previous_page_number: number | null;
  results: Event[];
}

/** Tournament round standings (paginated). */
export interface StandingEntry {
  rank?: number;
  placement?: number;
  player_name?: string;
  username?: string;
  display_name?: string;
  wins?: number;
  losses?: number;
  match_points?: number;
  opponent_match_win_pct?: number;
  game_win_pct?: number;
  [key: string]: unknown;
}

export interface StandingsResponse {
  count: number;
  total: number;
  page_size: number;
  current_page_number: number;
  next_page_number: number | null;
  previous_page_number: number | null;
  results: StandingEntry[];
}

/** Event registrations (paginated). */
export interface RegistrationEntry {
  id?: number;
  user?: { username?: string; display_name?: string; first_name?: string; last_name?: string; [key: string]: unknown };
  display_name?: string;
  username?: string;
  status?: string;
  registered_at?: string;
  [key: string]: unknown;
}

export interface RegistrationsResponse {
  count: number;
  total: number;
  page_size: number;
  current_page_number: number;
  next_page_number: number | null;
  previous_page_number: number | null;
  results: RegistrationEntry[];
}
