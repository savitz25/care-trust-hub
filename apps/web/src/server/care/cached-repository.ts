import "server-only";
import { cache } from "react";
import { getProviderByCcn } from "./repository";
import { getProviderRegulatoryIntelligence } from "./regulatory-repository";

export const getProviderByCcnForPage = cache(getProviderByCcn);
export const getProviderRegulatoryIntelligenceForPage = cache(getProviderRegulatoryIntelligence);
