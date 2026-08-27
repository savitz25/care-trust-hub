import "server-only";
import { assertSeniorHubIntelligence, type SeniorNationalIntelligence } from "@care/domain";
import payload from "@/data/senior-national-intelligence.json";

export function getSeniorHubIntelligence(): SeniorNationalIntelligence {
  return assertSeniorHubIntelligence(payload as SeniorNationalIntelligence);
}
