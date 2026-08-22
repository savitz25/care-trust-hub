import { ImageResponse } from "next/og";

export const alt = "SeniorTrustHub — Research senior care without being sold senior care";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 86px",
          background: "#fcfaf6",
          color: "#082860",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
          <svg width="96" height="96" viewBox="0 0 36 36" fill="none">
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
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ color: "#681860", fontSize: 82, fontWeight: 800, letterSpacing: 2 }}>
              SENIOR
            </span>
            <span style={{ color: "#082860", fontSize: 68, fontWeight: 800, letterSpacing: 5 }}>
              TRUST HUB
            </span>
          </div>
        </div>
        <div style={{ marginTop: 40, fontSize: 36, fontWeight: 700 }}>
          Research senior care without being sold senior care.
        </div>
        <div style={{ marginTop: 16, fontSize: 24, color: "#455451" }}>
          Independent nursing home research using published CMS evidence.
        </div>
        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#681860",
          }}
        >
          <span>ASK TRUST HUB NETWORK</span>
          <span>seniortrusthub.com</span>
        </div>
      </div>
    ),
    size,
  );
}
