import { describe, expect, it } from "vitest";
import {
  parseNetworkJourney,
  resolveSeniorJourneyModule,
} from "./journey-handoff";

describe("senior journey v2.1", () => {
  it("hides facility module without context", () => {
    expect(resolveSeniorJourneyModule({}, "facility")).toBeNull();
  });

  it("shows move only when relocate context exists", () => {
    const mod = resolveSeniorJourneyModule({ journey: "relocate" }, "facility");
    expect(mod?.primary.label).toBe("Plan the move");
    expect(mod?.primary.href).toContain("movetrusthub.com");
    expect(mod?.primary.href).not.toMatch(/name=|email=|diagnosis=/);
  });

  it("shows contractor only for aging-in-place context", () => {
    const mod = resolveSeniorJourneyModule({ journey: "contractor" }, "home");
    expect(mod?.primary.href).toContain("contractortrusthub.com");
  });

  it("parses only safe keys", () => {
    const ctx = parseNetworkJourney({
      src: "ask",
      journey: "relocate",
      state: "FL",
      name: "Jane Doe",
      email: "a@b.c",
    });
    expect(ctx.src).toBe("ask");
    expect(ctx.state).toBe("FL");
    expect(ctx).not.toHaveProperty("name");
    expect(ctx).not.toHaveProperty("email");
  });
});
