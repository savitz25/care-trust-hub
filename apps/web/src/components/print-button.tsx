"use client";

export function PrintButton({ label = "Print / share research" }: { label?: string }) {
  return (
    <button
      className="button button--quiet print-button"
      type="button"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
