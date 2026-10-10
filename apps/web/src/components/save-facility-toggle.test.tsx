import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PARENT_SYNC_UI, SaveFacilityToggle } from "./save-facility-toggle";
import { ShortlistButton } from "./shortlist-button";
import {
  SAVED_MAX,
  SAVED_STORAGE_KEY,
  isFacilitySaved,
  listSavedFacilities,
  saveFacility,
  unsaveFacility,
} from "@/lib/my-trusthub/saved-store";
import { FAMILY_WORKSPACE_STORAGE_KEY, addFacilityToWorkspace } from "./family-workspace-storage";

// Real published CMS nursing-home profiles (production, 2026-10-04).
const CANARY = [
  { ccn: "015009", name: "BURNS NURSING HOME, INC." },
  { ccn: "055223", name: "SAN JACINTO VALLEY POST ACUTE" },
  { ccn: "155805", name: "ADDISON POINTE HEALTH & REHABILITATION CENTER" },
] as const;

let network: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  network = vi.fn(async () => {
    throw new Error("no network in device mode");
  });
  vi.stubGlobal("fetch", network);
});
afterEach(() => vi.unstubAllGlobals());

describe("Save toggle, device mode (parent sync off)", () => {
  it("parent sync UI is off in this build", () => {
    expect(PARENT_SYNC_UI).toBe(false);
  });

  it.each(CANARY)(
    "A/B/C. $ccn: Save -> Saved -> Save -> Saved on the device only",
    async ({ ccn, name }) => {
      render(<SaveFacilityToggle ccn={ccn} name={name} />);
      const button = screen.getByRole("button", { name: `Save ${name}` });
      expect(button).toHaveTextContent("Save");
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button.closest("[data-parent-sync]")).toHaveAttribute("data-parent-sync", "off");

      await act(async () => void fireEvent.click(button));
      expect(button).toHaveTextContent("Saved");
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Saved on this device")).toBeInTheDocument();
      expect(JSON.parse(localStorage.getItem(SAVED_STORAGE_KEY)!)).toEqual([ccn]);

      await act(async () => void fireEvent.click(button));
      expect(button).toHaveTextContent("Save");
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(listSavedFacilities()).toEqual([]);

      await act(async () => void fireEvent.click(button));
      expect(button).toHaveTextContent("Saved");
      expect(listSavedFacilities()).toEqual([ccn]);

      // One control, no separate Unsave, no hand-off notice, no My TrustHub links.
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(
        document.querySelector("[data-mth-sync], [data-mth-sign-in], [data-mth-parent-held]"),
      ).toBeNull();
      // K/L. Nothing left the device and nothing but the saved list was written.
      expect(network).not.toHaveBeenCalled();
      expect(Object.keys(localStorage)).toEqual([SAVED_STORAGE_KEY]);
    },
  );

  it("shows an already-saved profile as Saved and follows changes made elsewhere", async () => {
    saveFacility("015009");
    render(<SaveFacilityToggle ccn="015009" name="BURNS NURSING HOME, INC." />);
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Saved");
    await act(async () => void unsaveFacility("015009"));
    expect(button).toHaveTextContent("Save");
  });

  it("reports failed removal, retains Saved, and allows a successful retry", async () => {
    saveFacility("015009");
    render(<SaveFacilityToggle ccn="015009" name="Synthetic facility" />);
    const button = screen.getByRole("button");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    try {
      await act(async () => void fireEvent.click(button));
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(listSavedFacilities()).toEqual(["015009"]);
      expect(screen.getByRole("status")).toHaveTextContent("Could not remove");
      expect(screen.getByRole("status")).not.toHaveTextContent("Removed");
      expect(network).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
    }
    await act(async () => void fireEvent.click(button));
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(listSavedFacilities()).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Removed");
  });

  it("removal reports persistence failure and already-absent success", () => {
    saveFacility("015009");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    try {
      expect(unsaveFacility("015009")).toBe(false);
      expect(isFacilitySaved("015009")).toBe(true);
      expect(unsaveFacility("055223")).toBe(true);
    } finally {
      write.mockRestore();
    }
  });

  it("the device store is idempotent, bounded and CCN-only", () => {
    expect([saveFacility("015009"), saveFacility("015009")]).toEqual(["saved", "already_saved"]);
    expect(listSavedFacilities()).toEqual(["015009"]);
    for (const bad of [
      "burns-nursing-home-inc",
      "BURNS NURSING HOME, INC.",
      "0001ac38-0c96-4e2f-8bf6-9ab243f7b79b",
      "15009",
      "",
    ])
      expect(saveFacility(bad)).toBe("invalid");
    for (let i = 1; i < SAVED_MAX; i++) expect(saveFacility(String(100000 + i))).toBe("saved");
    expect(saveFacility("999999")).toBe("full");
    expect(listSavedFacilities()).toHaveLength(SAVED_MAX);
    unsaveFacility("not-there");
    unsaveFacility("015009");
    expect(isFacilitySaved("015009")).toBe(false);
    localStorage.setItem(SAVED_STORAGE_KEY, "{broken");
    expect(listSavedFacilities()).toEqual([]);
  });

  it("a full list is reported and the toggle does not claim a Save", async () => {
    for (let i = 0; i < SAVED_MAX; i++) saveFacility(String(100000 + i));
    render(<SaveFacilityToggle ccn="015009" name="BURNS NURSING HOME, INC." />);
    const button = screen.getByRole("button");
    await act(async () => void fireEvent.click(button));
    expect(button).toHaveTextContent("Save");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/saved list is full \(10\)/)).toBeInTheDocument();
  });

  it("M. shares one list with the existing shortlist button and leaves the Family Workspace alone", async () => {
    addFacilityToWorkspace("055223");
    const workspaceBefore = localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY);
    render(
      <>
        <ShortlistButton ccn="155805" />
        <SaveFacilityToggle ccn="015009" name="BURNS NURSING HOME, INC." />
      </>,
    );
    await act(
      async () => void fireEvent.click(screen.getByRole("button", { name: "Save to shortlist" })),
    );
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: /Save BURNS/ })));
    expect(listSavedFacilities()).toEqual(["155805", "015009"]);
    await act(
      async () => void fireEvent.click(screen.getByRole("button", { name: /Saved: BURNS/ })),
    );
    expect(listSavedFacilities()).toEqual(["155805"]);
    expect(localStorage.getItem(FAMILY_WORKSPACE_STORAGE_KEY)).toBe(workspaceBefore);
    expect(network).not.toHaveBeenCalled();
  });
});
