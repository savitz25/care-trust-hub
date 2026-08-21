import { describe, expect, it } from "vitest";
import { seniorEntityShareModel, truncateShareText } from "./share-card-model";

describe("SHARE-003 Senior share models", () => {
  it("uses public name and location without ratings", () => {
    const model = seniorEntityShareModel({
      name: "Harbor Pines Nursing & Rehabilitation",
      city: "Clearwater Junction",
      state: "IN",
      careType: "Nursing home & rehabilitation",
    });
    expect(model.title).toContain("Harbor Pines");
    expect(model.subtitle).toContain("Clearwater Junction");
    expect(JSON.stringify(model)).not.toMatch(/star|deficiency|penalty|trusted|approved/i);
  });

  it("truncates long names", () => {
    expect(truncateShareText("A".repeat(80), 48).endsWith("…")).toBe(true);
  });
});
