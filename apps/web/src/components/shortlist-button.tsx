"use client";
import { useState } from "react";
import { captureTrustEvent } from "@/lib/analytics/trusthub";
const KEY = "care-public-shortlist-v1";
export function ShortlistButton({ ccn }: { ccn: string }) {
  const [saved, setSaved] = useState(false);
  const save = () => {
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(parsed)) ids = parsed.filter((item) => typeof item === "string");
    } catch {}
    ids = [...new Set([...ids, ccn])].slice(0, 10);
    localStorage.setItem(KEY, JSON.stringify(ids));
    setSaved(true);
    captureTrustEvent("profile_saved", { surface: "shortlist", success: true });
  };
  return (
    <button className="button button--secondary" type="button" onClick={save} aria-pressed={saved}>
      {saved ? "Saved" : "Save to shortlist"}
    </button>
  );
}
