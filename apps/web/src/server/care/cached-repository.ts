import "server-only";
import { cache } from "react";
import { getProviderByCcn } from "./repository";
import { getProviderOwnershipIntelligence } from "./ownership-repository";
import { getProviderRegulatoryIntelligence } from "./regulatory-repository";
import { getProviderStaffingSummary } from "./staffing-repository";

export const getProviderByCcnForPage = cache(getProviderByCcn);
export const getProviderRegulatoryIntelligenceForPage = cache(getProviderRegulatoryIntelligence);
export const getProviderStaffingSummaryForPage = cache(getProviderStaffingSummary);
export const getProviderOwnershipIntelligenceForPage = cache(getProviderOwnershipIntelligence);
