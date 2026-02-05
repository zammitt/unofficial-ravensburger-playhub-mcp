#!/usr/bin/env node

const REQUIRED_MAJOR = 20;
const major = Number.parseInt(process.versions.node.split(".")[0], 10);

if (major !== REQUIRED_MAJOR) {
  console.error(`This repository expects Node ${REQUIRED_MAJOR}.x for development and tests.`);
  console.error(`Current Node version: ${process.version}`);
  console.error("Run `nvm use` (reads .nvmrc) and try again.");
  process.exit(1);
}
