"use client";

import { useEffect } from "react";
import { captureTrustEvent } from "@/lib/analytics/trusthub";
import { recordedState } from "@/lib/analytics/privacy";

export function ProfileViewed({ surface, state }: { surface: string; state?: string | null }) {
  const recorded = recordedState(state);
  useEffect(() => {
    captureTrustEvent("profile_viewed", { surface, state: recorded, success: true });
  }, [surface, recorded]);
  return null;
}
