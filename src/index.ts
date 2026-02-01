#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadFilterOptions } from "./lib/api.js";
import { registerEventTools } from "./tools/events.js";
import { registerFilterTools } from "./tools/filters.js";
import { registerStoreTools } from "./tools/stores.js";

// Resolve symlinks so we detect entry when run via npm/npx bin (which uses a symlink)
function isEntryModule(): boolean {
  if (process.argv[1] == null) return false;
  try {
    const argvPath = realpathSync(process.argv[1]);
    const selfPath = realpathSync(fileURLToPath(import.meta.url));
    return argvPath === selfPath;
  } catch {
    return false;
  }
}

const server = new McpServer({
  name: "lorcana-event-finder",
  version: "1.0.0",
});

registerEventTools(server);
registerStoreTools(server);
registerFilterTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lorcana Event Finder MCP server running on stdio");

  // Load format/category maps in background so we don't block the MCP handshake
  // (Cursor and other clients time out if the server doesn't respond to initialize quickly)
  loadFilterOptions().catch((err) => console.error("Failed to load filter options:", err));
}

if (isEntryModule()) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
