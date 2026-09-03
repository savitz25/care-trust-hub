import type { SeniorShareCardModel } from "@/config/share-card-model";
import { NETWORK_OG_SIZE, renderNetworkShareImage } from "./network-share-card";

export const SENIOR_OG_SIZE = NETWORK_OG_SIZE;
export const SENIOR_OG_CONTENT_TYPE = "image/png";
const CONFIG = {
  hub: "SENIOR TRUST HUB",
  descriptor: "Independent Senior Care Research",
  domain: "seniortrusthub.com",
  accent: "#681860",
};

export function renderSeniorShareImage(model: SeniorShareCardModel) {
  return renderNetworkShareImage(CONFIG, model);
}

export function renderSeniorFallbackImage() {
  return renderNetworkShareImage(CONFIG);
}
