# Lorcana Event Finder (MCP Server)

An **MCP (Model Context Protocol) server** that lets AI assistants look up **Disney Lorcana TCG** events, stores, and tournament data. It talks to the official Ravensburger Play API so you can ask things like “Where can I play Lorcana near Seattle?” or “What events are coming up in Austin?” from Cursor, Claude Desktop, Claude Code, or any MCP client.

## What you need

- **Node.js** 18+ (for `node --test` and ESM)
- **npm** (comes with Node)

No API keys or configuration are required. Event and store search work out of the box.

## Quick start

**From npm (no clone):**

```bash
npx -y unofficial-ravensburger-playhub-mcp
```

**From source:**

```bash
git clone https://github.com/zammitt/unofficial-ravensburger-playhub-mcp.git
cd unofficial-ravensburger-playhub-mcp
npm install
npm run build
npm start
```

The server runs over stdio. Add it as an MCP server in your client (e.g. Cursor) to use the tools.

## Using with Cursor

Cursor limits the **combined server name + tool name** to 60 characters. Use a **short key** (e.g. `lorcana-event-finder`) in `mcpServers` so tools like `get_tournament_round_standings` don’t get filtered out.

**Option A — npx (easiest):** No clone or build. In **Settings → MCP**, add:

```json
{
  "mcpServers": {
    "lorcana-event-finder": {
      "command": "npx",
      "args": ["-y", "unofficial-ravensburger-playhub-mcp"]
    }
  }
}
```

**Option B — from a local clone:** Build first (`npm run build`), then point at the built script:

```json
{
  "mcpServers": {
    "lorcana-event-finder": {
      "command": "node",
      "args": ["/path/to/unofficial-ravensburger-playhub-mcp/dist/index.js"]
    }
  }
}
```

After that, the Lorcana Event Finder tools are available to the AI in Cursor.

**If you see "No matching version found" when Cursor starts the server:** Clear npx’s cache, then reload MCP. In a terminal run: `rm -rf ~/.npm/_npx` (on Windows: `rmdir /s /q %APPDATA%\npm-cache\_npx`), then restart Cursor or reload MCP.

**If you see "command not found" when running npx in a terminal:** Don’t run npx from inside the package directory (same name as the package). npx will use the local project and the bin wrapper can fail. Run from another directory, e.g. `cd ~` then `npx -y unofficial-ravensburger-playhub-mcp`.

## Using with Claude

Add the server to **Claude Desktop** by editing your MCP config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Option A — npx (easiest):** No clone or build. Add or merge into the `mcpServers` object:

```json
{
  "mcpServers": {
    "lorcana-event-finder": {
      "command": "npx",
      "args": ["-y", "unofficial-ravensburger-playhub-mcp"]
    }
  }
}
```

**Option B — from a local clone:** Build first (`npm run build`), then point at the built script:

```json
{
  "mcpServers": {
    "lorcana-event-finder": {
      "command": "node",
      "args": ["/path/to/unofficial-ravensburger-playhub-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop after changing the config. The Lorcana Event Finder tools will then be available to Claude.

## Using with Claude Code

**Claude Code** (the IDE) can use this server via the CLI or by editing config. Options must come *before* the server name; `--` separates the name from the command.

**Option A — CLI with npx (easiest):** No clone or build. Run in your project or from any directory:

```bash
claude mcp add --transport stdio unofficial-ravensburger-playhub-mcp -- npx -y unofficial-ravensburger-playhub-mcp
```

Use `--scope user` to make it available in all projects:

```bash
claude mcp add --transport stdio --scope user unofficial-ravensburger-playhub-mcp -- npx -y unofficial-ravensburger-playhub-mcp
```

**Option B — CLI from a local clone:** Build first (`npm run build`), then:

```bash
claude mcp add --transport stdio unofficial-ravensburger-playhub-mcp -- node /path/to/unofficial-ravensburger-playhub-mcp/dist/index.js
```

**Option C — Config file:** Add the same `mcpServers` entry as in the Cursor/Claude Desktop sections to:

- **Project scope:** `.mcp.json` in your project root (share with the team), or  
- **User scope:** `~/.claude.json` (in the `mcpServers` object).

Example for `.mcp.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "lorcana-event-finder": {
      "command": "npx",
      "args": ["-y", "unofficial-ravensburger-playhub-mcp"]
    }
  }
}
```

**Windows (native, not WSL):** For npx-based servers, use the `cmd /c` wrapper:

```bash
claude mcp add --transport stdio unofficial-ravensburger-playhub-mcp -- cmd /c npx -y unofficial-ravensburger-playhub-mcp
```

Check that the server is listed with `claude mcp list`; in Claude Code you can run `/mcp` to see status.

### LLM-friendly design

Tool descriptions include **when to use** each tool (e.g. city name → `search_events_by_city`, coordinates → `search_events`). Call **list_capabilities** first if the assistant is unsure which tool to use. **list_filters** returns exact format/category names for event search parameters.

## MCP tools

The server exposes tools that are easy for LLMs to choose and call: descriptions include **when to use** each tool, and optional parameters are clearly documented. Call **list_capabilities** first if unsure which tool to use.

| Tool | When to use |
|------|-------------|
| **list_capabilities** | Call first when unsure which tool to use (e.g. search_events vs search_events_by_city). Returns a short guide. |
| **list_filters** | Before searching events by format or category; returns exact names for the `formats` and `categories` parameters. |
| **search_events** | When you have latitude/longitude (e.g. from a map or device). |
| **search_events_by_city** | When the user says a city name (e.g. "events in Seattle" or "Austin, TX"). Geocoded. |
| **get_store_events** | Events at a specific store by store ID (from search_stores). Use when the user asks about events at a particular store (e.g. "events at Game Haven"). No city or geocoding needed. |
| **get_event_details** | Full details for one event; use when you have an event ID. For tournaments, the response includes **round IDs**. |
| **get_event_standings** | **Event results/standings** by event ID. Use for "championship results", "who won", or "standings". The tool finds rounds and returns standings automatically—prefer over get_tournament_round_standings when the user asks for event results. |
| **get_player_leaderboard** | **Aggregate player performance** across multiple past events in a region and date range. Use when the user asks who had the most wins, top performers, or best record over many events (e.g. "who had the most wins in set championships in January 2026 in Detroit"). Single tool call; no need to search events then call get_event_standings per event. Date range max 3 months; radius max 100 miles. Call list_filters first for valid category/format names. |
| **get_player_leaderboard_by_store** | **Aggregate player performance** across past events at a specific store. Use when the user asks for top performers or leaderboard at a particular store (e.g. "leaderboard at Game Haven", "best players at store 123"). Get store ID from search_stores. Same date range (max 3 months), sort options, and format/category filters as get_player_leaderboard. |
| **get_event_registrations** | Who is signed up for an event (names from API); needs event ID. |
| **get_tournament_round_standings** | Standings for a specific round when you have a round ID (e.g. from get_event_details). |
| **get_round_matches** | Pairings and match results for a round; needs round ID (from get_event_details). Use for "who played whom" or match results. |
| **search_stores** | Stores or venues; optional name search and/or lat/long + radius. |
| **search_stores_by_city** | Stores near a city name (e.g. "stores in Seattle"). |

**Dates:** When you omit `start_date`, search uses the **start of today (UTC)** so events that already started today are included. For "today's events" pass `start_date: "YYYY-MM-DD"` with today's date (correct year).

**get_player_leaderboard** and **get_player_leaderboard_by_store** can take longer when many events match (they fetch and aggregate standings for each). Use a narrow date range or category (e.g. "Set Championship") to keep results focused.

### Performance – caching

The server caches **completed (past) events** and their **round standings** in memory. Once an event is finished, its data does not change, so repeat lookups (e.g. the same event details or leaderboard date range) avoid extra API calls. Caches are shared across all tools and are bounded (up to 500 events, 1000 rounds) with simple eviction. Upcoming and in-progress events are never cached.

## Development

```bash
npm install
npm run build   # compile TypeScript to dist/
npm test        # run all tests from dist/ (unit + integration); run build first
npm run test:coverage   # run tests with coverage report (c8)
```

- **`npm run dev`** – Run the server with `tsx` (no build step) for quick iteration.
- **`npm start`** – Run the compiled server: `node dist/index.js`.

### Project structure

| Path | Purpose |
|------|---------|
| **`src/index.ts`** | MCP server entry point: create server, register tools, run stdio transport. |
| **`src/lib/`** | Core library: `types.ts`, `api.ts`, `formatters.ts` (Ravensburger API client, types, human-readable formatters). |
| **`src/tools/`** | MCP tool handlers: `events.ts`, `stores.ts`, `filters.ts`. |
| **`src/test/`** | Unit tests (api, formatters) and integration tests (MCP server + tools). |

### Tests

- **Unit tests** – `api.test.ts` (API client: filter maps, strict resolution, fetch with mocked `fetch`, `loadFilterOptions`), `formatters.test.ts` (formatStore, formatEvent, formatLeaderboard, formatLeaderboardEntry, formatStandingEntry, formatRegistrationEntry), `registrations.test.ts`, `standings.test.ts`. No network required for unit tests.
- **Integration tests** – `src/test/mcp-tools.integration.test.ts` spawns the MCP server and calls each tool (required-only, optional params, pagination). They hit the real Ravensburger Play API and Nominatim for geocoding, so **network access is required** and tests may be slower or flaky if the APIs are slow or down.

Coverage is reported for `dist/` (excluding `dist/test/`). Run `npm run test:coverage` to see statement/branch/function coverage for the app code.

## API and data

Data comes from the **Ravensburger Play API** (events, stores, formats, categories, registrations, tournament rounds/standings). City-based search uses **Nominatim** (OpenStreetMap) for geocoding. Neither API requires keys.

**Player names:** Standings, round matches, registrations, and leaderboards show the player’s **display name** (username) when the API provides it, and fall back to first name + last initial (e.g. "Joseph C") when no display name is set.

## Security & privacy

- No API keys or secrets are stored in this repo or by the server.
- All tools use public Ravensburger and Nominatim endpoints with no authentication.

## Publishing to npm

1. **Create an npm account** (if needed): [npmjs.com/signup](https://www.npmjs.com/signup).
2. **Enable 2FA (required to publish):** npm requires two-factor authentication to publish. In [Account Settings → Two-Factor Authentication](https://www.npmjs.com/settings/~yourusername/account), turn on 2FA (auth-only or auth-and-writes). You’ll be prompted for the code when you run `npm publish`.
3. **Log in from the CLI:** `npm login` (username, password, OTP when prompted).
4. **Check the package name:** Ensure `unofficial-ravensburger-playhub-mcp` is not taken: [npmjs.com/package/unofficial-ravensburger-playhub-mcp](https://www.npmjs.com/package/unofficial-ravensburger-playhub-mcp). If it is taken, change `name` in `package.json` (and optionally scope it, e.g. `@yourusername/unofficial-ravensburger-playhub-mcp`).
5. **Dry run:** `npm publish --dry-run` to see what would be uploaded (no publish).
6. **Publish:** `npm publish`. You’ll be prompted for your 2FA code. The `prepublishOnly` script runs `npm run build` first, so `dist/` is built automatically.
7. **Later releases:** Bump `version` in `package.json` (e.g. `1.0.1`), then run `npm publish` again.

## License

[Unlicense](https://unlicense.org) — public domain. No copyright, no warranty, no liability. Use at your own risk.
