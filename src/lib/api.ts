/**
 * API surface delegated to the shared playhub API package.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playhubApi = require("unofficial-ravensburger-playhub-api") as typeof import("unofficial-ravensburger-playhub-api");

export const STATUSES = playhubApi.STATUSES;
export const expandStatusesForApi = playhubApi.expandStatusesForApi;
export const clearCaches = playhubApi.clearCaches;
export const getCacheStats = playhubApi.getCacheStats;
export const loadFilterOptions = playhubApi.loadFilterOptions;
export const updateFilterMaps = playhubApi.updateFilterMaps;
export const fetchGameplayFormats = playhubApi.fetchGameplayFormats;
export const fetchCategories = playhubApi.fetchCategories;
export const fetchEvents = playhubApi.fetchEvents;
export const fetchEventDetails = playhubApi.fetchEventDetails;
export const fetchEventRegistrations = playhubApi.fetchEventRegistrations;
export const fetchTournamentRoundStandings = playhubApi.fetchTournamentRoundStandings;
export const fetchTournamentRoundMatches = playhubApi.fetchTournamentRoundMatches;
export const fetchStores = playhubApi.fetchStores;
export const resolveFormatIds = playhubApi.resolveFormatIds;
export const resolveCategoryIds = playhubApi.resolveCategoryIds;
export const resolveFormatIdsStrict = playhubApi.resolveFormatIdsStrict;
export const resolveCategoryIdsStrict = playhubApi.resolveCategoryIdsStrict;
export const getCategoryName = playhubApi.getCategoryName;
export const fetchAllRoundStandings = playhubApi.fetchAllRoundStandings;
export const getEventStandings = playhubApi.getEventStandings;
export const fetchAllEventStandings = playhubApi.fetchAllEventStandings;
