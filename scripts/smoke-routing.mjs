import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(content, needle, context) {
  if (!content.includes(needle)) {
    throw new Error(`Missing "${needle}" in ${context}`);
  }
}

function main() {
  const app = read("src/App.tsx");
  const controlTower = read("src/pages/ControlTower.tsx");
  const copilote = read("src/pages/Copilote.tsx");

  const requiredRoutes = [
    '/app/control-tower',
    '/app/centre-veille/reglementation',
    '/app/simulator',
    '/app/invoice-check',
    '/app/assistant',
  ];

  for (const route of requiredRoutes) {
    assertIncludes(app, route, "src/App.tsx");
  }

  assertIncludes(controlTower, "PanoramicControlTowerMap", "src/pages/ControlTower.tsx");
  assertIncludes(controlTower, "RssFooter", "src/pages/ControlTower.tsx");

  assertIncludes(copilote, 'fetch("/api/chat"', "src/pages/Copilote.tsx");
  assertIncludes(copilote, "buildAssistantBlocks", "src/pages/Copilote.tsx");

  console.log("smoke-routing: ok");
}

try {
  main();
} catch (error) {
  console.error("smoke-routing: failed");
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
