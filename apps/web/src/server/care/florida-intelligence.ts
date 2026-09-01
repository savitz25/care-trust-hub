import "server-only";
import { assertFloridaIntelligence, type FloridaIntelligence } from "@care/domain";
import payload from "@/data/florida-intelligence.json";

export function getFloridaIntelligence(): FloridaIntelligence {
  return assertFloridaIntelligence(payload as FloridaIntelligence);
}
