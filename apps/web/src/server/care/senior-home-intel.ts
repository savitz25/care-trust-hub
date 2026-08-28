import "server-only";
import { assertSeniorHomeIntel, buildSeniorHomeIntel } from "@care/domain";
import florida from "@/data/florida-intelligence.json";
import publication from "@/data/florida-provider-publication.json";
import { getSeniorHubIntelligence } from "./senior-hub-intelligence";

export function getSeniorHomeIntel() {
  return assertSeniorHomeIntel(
    buildSeniorHomeIntel({
      national: getSeniorHubIntelligence(),
      floridaIdentities: florida.providers.current,
      floridaRegulatoryObservations: florida.regulatory.observations,
      publishedAlfAfch: publication.n,
    }),
  );
}
