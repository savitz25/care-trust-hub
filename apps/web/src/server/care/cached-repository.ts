import "server-only";
import { cache } from "react";
import { getProviderByCcn } from "./repository";
import { getProviderOwnershipIntelligence } from "./ownership-repository";
import { getProviderChainIntelligence } from "./chain-repository";
import { getProviderRegulatoryIntelligence } from "./regulatory-repository";
import { getProviderStaffingSummary } from "./staffing-repository";
import { getApprovedProviderContext } from "./trust-participation";
import { getPublishedFacilityEnrichment } from "./enrichment-publication";
import { getPublishedStateIntelligence } from "./state-publication";

export const getProviderByCcnForPage = cache(getProviderByCcn);
export const getProviderRegulatoryIntelligenceForPage = cache(getProviderRegulatoryIntelligence);
export const getProviderStaffingSummaryForPage = cache(getProviderStaffingSummary);
export const getProviderOwnershipIntelligenceForPage = cache(getProviderOwnershipIntelligence);
export const getProviderChainIntelligenceForPage = cache(getProviderChainIntelligence);
export const getApprovedProviderContextForPage = cache(getApprovedProviderContext);
export const getPublishedFacilityEnrichmentForPage = cache(getPublishedFacilityEnrichment);
export const getPublishedStateIntelligenceForPage = cache(getPublishedStateIntelligence);
