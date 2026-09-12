"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Link disclosure: ordinary Tab navigation, Escape/outside close, no menu-role arrow-key contract. */
export function HeaderDisclosure({
  label,
  children,
  buttonClass = "th-nav-link",
  panelClass = "th-state-panel",
}: {
  label: string;
  children: ReactNode;
  buttonClass?: string;
  panelClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const other = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    document.addEventListener("senior-header-disclosure", other);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      document.removeEventListener("senior-header-disclosure", other);
    };
  }, [open, id]);
  return (
    <div
      ref={root}
      className="th-switch"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={buttonClass}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open)
            document.dispatchEvent(new CustomEvent("senior-header-disclosure", { detail: id }));
          setOpen(!open);
        }}
      >
        {label} <span aria-hidden="true">⌄</span>
      </button>
      <div
        id={id}
        className={panelClass}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as Element).closest("a")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
