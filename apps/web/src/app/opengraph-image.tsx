import { ImageResponse } from "next/og";

export const alt = "SeniorTrustHub — Research senior care without being sold senior care";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const node = (color: string, left: number, top: number) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width: 26,
      height: 26,
      borderRadius: 26,
      background: color,
    }}
  />
);

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
          <div style={{ position: "relative", width: 170, height: 170, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 10,
                width: 30,
                height: 150,
                borderLeft: "12px solid #681860",
                borderTop: "12px solid #681860",
                borderBottom: "12px solid #681860",
                borderRadius: 6,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 10,
                width: 30,
                height: 150,
                borderRight: "12px solid #681860",
                borderTop: "12px solid #681860",
                borderBottom: "12px solid #681860",
                borderRadius: 6,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 84,
                top: 42,
                width: 7,
                height: 86,
                background: "#082860",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 45,
                top: 81,
                width: 86,
                height: 7,
                background: "#082860",
              }}
            />
            {node("#F86008", 75, 14)}
            {node("#18B8E0", 18, 72)}
            {node("#88C828", 130, 72)}
            {node("#8B5CF6", 75, 130)}
            {node("#082860", 70, 67)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ color: "#681860", fontSize: 82, fontWeight: 800, letterSpacing: 2 }}>
              SENIOR
            </span>
            <span style={{ color: "#082860", fontSize: 68, fontWeight: 800, letterSpacing: 5 }}>
              TRUST HUB
            </span>
          </div>
        </div>
        <div style={{ marginTop: 58, fontSize: 42, fontWeight: 700 }}>
          Research senior care without being sold senior care.
        </div>
        <div style={{ marginTop: 20, fontSize: 27, color: "#455451" }}>
          Independent nursing home research using published CMS evidence.
        </div>
      </div>
    ),
    size,
  );
}
