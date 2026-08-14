import type { CSSProperties } from "react";

const shell: CSSProperties = { width: "min(calc(100% - 2rem), 72rem)", marginInline: "auto" };

export function Header({ productName, networkName }: { productName: string; networkName: string }) {
  return (
    <header
      style={{ borderBottom: "1px solid var(--color-warm-100)", background: "var(--color-white)" }}
    >
      <div
        style={{
          ...shell,
          minHeight: "4.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <strong>{productName}</strong>
        <span style={{ fontSize: "0.9rem", color: "var(--color-slate-700)" }}>
          Part of {networkName}
        </span>
      </div>
    </header>
  );
}

export function Footer({ philosophy, networkName }: { philosophy: string; networkName: string }) {
  return (
    <footer
      style={{
        background: "var(--color-evergreen-700)",
        color: "var(--color-white)",
        paddingBlock: "2rem",
      }}
    >
      <div style={shell}>
        <strong>{philosophy}</strong>
        <p style={{ marginBottom: 0 }}>
          An independent research foundation in the {networkName} network.
        </p>
      </div>
    </footer>
  );
}
