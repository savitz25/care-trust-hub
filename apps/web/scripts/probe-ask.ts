import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvironment(): void {
  for (const relative of [".env.local", "../../.env.local", "apps/web/.env.local"]) {
    try {
      for (const sourceLine of readFileSync(resolve(relative), "utf8").split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) continue;
        const [key, ...parts] = line.split("=");
        if (!process.env[key])
          process.env[key] = parts.join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {
      // optional
    }
  }
}
loadEnvironment();

async function main() {
  const { interpretSeniorAskQuery } = await import("../src/server/care/senior-ask-parse");
  const { executeSeniorResearchQuery } = await import("../src/server/care/senior-ask-execute");

  const queries = process.argv.slice(2).length
    ? process.argv.slice(2)
    : [
        "assisted living near Naples Florida",
        "in-home caregiver Austin",
        "memory care facility around Tacoma",
        "elder care services",
        "retirement community Boulder Colorado",
        "adult day care Palm Beach FL",
        "Brookdale Senior Living",
        "senior care homes Newark NJ",
        "nursing home Sacramento County",
      ];

  for (const q of queries) {
    console.log("=====", q, "=====");
    const parsed = interpretSeniorAskQuery(q);
    console.log(
      "parsed:",
      JSON.stringify(
        {
          mode: parsed.mode,
          providerClass: parsed.providerClass,
          geography: parsed.geography,
          identityQuery: parsed.identityQuery,
          clarification: parsed.clarification,
          failReason: parsed.failReason,
          locationRequirement: parsed.locationRequirement,
        },
        null,
        0,
      ),
    );
    try {
      const result = await executeSeniorResearchQuery(q);
      console.log(
        "result: entities=",
        result.entities.length,
        JSON.stringify(result.entities.slice(0, 5).map((e) => `${e.providerName} (${e.location})`)),
        "classPreviews=",
        JSON.stringify(
          result.classPreviews?.map((c) => ({
            cls: c.providerClass,
            n: c.entities.length,
            sample: c.entities.slice(0, 3).map((e) => e.location),
          })),
        ),
        "failClosed=",
        JSON.stringify(result.failClosed),
      );
    } catch (err) {
      console.log("EXECUTE ERROR:", err instanceof Error ? err.message : err);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
