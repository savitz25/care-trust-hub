import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/brand-logo", () => ({ BrandLogo: () => <span>Senior home</span> }));
vi.mock("@/components/published-state-navigation", () => ({
  PublishedStateNavigation: () => <button>By state</button>,
}));
vi.mock("@/components/switch-hub-menu", () => ({
  SwitchHubMenu: () => <button>Switch Hub</button>,
}));

const ACCOUNT_NAME = "My TrustHub account";
const ACCOUNT_URL = "https://www.asktrusthub.com/my";
const dialogPrototype = HTMLDialogElement.prototype;
const originalShowModal = Object.getOwnPropertyDescriptor(dialogPrototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(dialogPrototype, "close");

beforeEach(() => {
  // jsdom has no modal-dialog or media-query implementation. Actual responsive
  // visibility and keyboard tab order are checked in the four-viewport browser QA.
  Object.defineProperties(dialogPrototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalShowModal) Object.defineProperty(dialogPrototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(dialogPrototype, "showModal");
  if (originalClose) Object.defineProperty(dialogPrototype, "close", originalClose);
  else Reflect.deleteProperty(dialogPrototype, "close");
});

function openMenu() {
  const trigger = screen.getByRole("button", { name: "Open menu" });
  fireEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: "SeniorTrustHub menu" }) };
}

describe("Senior My TrustHub account navigation", () => {
  it("provides one neutral, focusable desktop account link and preserves Shortlist", () => {
    render(<SiteHeader />);
    const header = within(screen.getByRole("banner"));
    const links = header.getAllByRole("link", { name: ACCOUNT_NAME, exact: true });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", ACCOUNT_URL);
    expect(links[0]).not.toHaveAttribute("target");
    expect(links[0].tabIndex).toBe(0);
    links[0].focus();
    expect(links[0]).toHaveFocus();
    expect(header.getByRole("link", { name: "Shortlist" })).toHaveAttribute("href", "/shortlist");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: ACCOUNT_NAME, exact: true })).toHaveLength(1);
  });

  it("provides one mobile account link without replacing the existing research navigation", () => {
    render(<SiteHeader />);
    const { dialog } = openMenu();
    const menu = within(dialog);
    const links = menu.getAllByRole("link", { name: ACCOUNT_NAME, exact: true });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", ACCOUNT_URL);
    expect(links[0]).not.toHaveAttribute("target");
    expect(links[0].tabIndex).toBe(0);
    links[0].focus();
    expect(links[0]).toHaveFocus();
    for (const [name, href] of [
      ["Shortlist", "/shortlist"],
      ["Find care", "/search"],
      ["Compare", "/compare"],
      ["Care Needs Navigator", "/tools/care-needs-navigator"],
    ]) {
      expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
    expect(menu.queryByText(/sign up|sync|automatically saved/i)).not.toBeInTheDocument();
  });

  it("closes the mobile drawer and restores focus when the account link is selected", () => {
    render(<SiteHeader />);
    const { trigger, dialog } = openMenu();
    const account = within(dialog).getByRole("link", { name: ACCOUNT_NAME, exact: true });
    // Suppress jsdom's cross-site navigation, while retaining the real React click.
    account.addEventListener("click", (event) => event.preventDefault());
    account.focus();
    fireEvent.click(account);
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getAllByRole("link", { name: ACCOUNT_NAME, exact: true })).toHaveLength(1);
  });

  it("keeps dialog cancellation and Shortlist navigation closing behavior", () => {
    render(<SiteHeader />);
    const { trigger, dialog } = openMenu();
    expect(within(dialog).getByRole("button", { name: "Close menu" })).toHaveFocus();
    fireEvent(dialog, new Event("cancel", { bubbles: true }));
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    const shortlist = within(dialog).getByRole("link", { name: "Shortlist" });
    shortlist.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(shortlist);
    expect(dialog).not.toHaveAttribute("open");
    expect(trigger).toHaveFocus();
  });
});
