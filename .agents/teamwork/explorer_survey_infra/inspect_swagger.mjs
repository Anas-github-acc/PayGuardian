import { buildApp } from "../../../apps/api/src/app.js";

async function main() {
  const app = buildApp({ logger: false });
  await app.ready();
  const spec = app.swagger();
  console.log("OpenAPI Version:", spec.openapi);
  console.log("Total Paths:", Object.keys(spec.paths || {}).length);
  console.log("Paths list:");
  for (const path of Object.keys(spec.paths || {})) {
    console.log(`  ${path}: [${Object.keys(spec.paths[path]).join(", ")}]`);
  }
}

main().catch(console.error);
