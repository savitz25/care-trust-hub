import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import type { SeniorShareCardModel } from "@/config/share-card-model";

export const SENIOR_OG_SIZE = { width: 1200, height: 630 };
export const SENIOR_OG_CONTENT_TYPE = "image/png";

const node = (color: string, left: number, top: number) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: 18,
      height: 18,
      borderRadius: 18,
      background: color,
    }}
  />
);

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
          <div style={{ position: "relative", width: 72, height: 72, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 4,
                width: 16,
                height: 64,
                borderLeft: "6px solid #681860",
                borderTop: "6px solid #681860",
                borderBottom: "6px solid #681860",
                borderRadius: 4,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 4,
                width: 16,
                height: 64,
                borderRight: "6px solid #681860",
                borderTop: "6px solid #681860",
                borderBottom: "6px solid #681860",
                borderRadius: 4,
              }}
            />
            {node("#F86008", 27, 4)}
            {node("#18B8E0", 6, 27)}
            {node("#88C828", 48, 27)}
            {node("#8B5CF6", 27, 50)}
          </div>
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
