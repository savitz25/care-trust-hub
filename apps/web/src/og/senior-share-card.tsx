import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import type { SeniorShareCardModel } from "@/config/share-card-model";

export const SENIOR_OG_SIZE = { width: 1200, height: 630 };
export const SENIOR_OG_CONTENT_TYPE = "image/png";

function SeniorFrame({ children, accent }: { children: ReactNode; accent: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "52px 64px",
        background: "#fcfaf6",
        color: "#082860",
        fontFamily: "Arial, sans-serif",
        position: "relative",
      }}
    >
      {accent ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: "#681860",
          }}
        />
      ) : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 36 36" fill="none">
            <path
              d="M9 5H5v26h4"
              stroke="#681860"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M27 5h4v26h-4"
              stroke="#681860"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="18" y1="11.2" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
            <line x1="12.2" y1="18" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
            <line x1="23.8" y1="18" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
            <line x1="18" y1="24.8" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
            <circle cx="18" cy="18" r="2.1" fill="#082860" />
            <circle cx="18" cy="10.2" r="2.5" fill="#F86008" />
            <circle cx="11.2" cy="18" r="2.5" fill="#18B8E0" />
            <circle cx="24.8" cy="18" r="2.5" fill="#88C828" />
            <circle cx="18" cy="25.8" r="2.5" fill="#8B5CF6" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#681860", fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>
              SENIOR
            </span>
            <span style={{ color: "#082860", fontSize: 18, fontWeight: 800, letterSpacing: 3 }}>
              TRUST HUB
            </span>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#681860" }}>
          ASK TRUST HUB NETWORK
        </div>
      </div>
      {children}
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 20, fontWeight: 700 }}
      >
        <span style={{ color: "#455451" }}>Independent senior care research</span>
        <span style={{ color: "#681860" }}>seniortrusthub.com</span>
      </div>
    </div>
  );
}

export function renderSeniorShareImage(model: SeniorShareCardModel) {
  return new ImageResponse(
    (
      <SeniorFrame accent={model.kind === "entity"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1020 }}>
          {model.eyebrow ? (
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "#681860" }}>
              {model.eyebrow}
            </div>
          ) : null}
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.08 }}>{model.title}</div>
          {model.subtitle ? (
            <div style={{ fontSize: 28, fontWeight: 600, color: "#082860" }}>{model.subtitle}</div>
          ) : null}
          {model.fact ? <div style={{ fontSize: 22, color: "#455451" }}>{model.fact}</div> : null}
        </div>
      </SeniorFrame>
    ),
    { ...SENIOR_OG_SIZE },
  );
}

export function renderSeniorFallbackImage() {
  return new ImageResponse(
    (
      <SeniorFrame accent={false}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>
            Research senior care without being sold senior care.
          </div>
          <div style={{ fontSize: 24, color: "#455451" }}>
            Independent nursing home research using published CMS evidence.
          </div>
        </div>
      </SeniorFrame>
    ),
    { ...SENIOR_OG_SIZE },
  );
}
