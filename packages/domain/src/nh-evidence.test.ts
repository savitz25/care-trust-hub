import { describe, expect, it } from "vitest";
import {
  ENROLLMENT_NPI_LABEL,
  MDS_NOT_STAR_RATING,
  abuseIconConsumerExplanation,
  directoryStatusConsumerExplanation,
  sffConsumerExplanation,
} from "./nh-evidence";

describe("SEN-NAT-002 consumer language", () => {
  it("does not treat SFF candidate as SFF", () => {
    const text = sffConsumerExplanation("SFF_CANDIDATE");
    expect(text).toContain("candidate");
    expect(text).toContain("not the same as being designated a Special Focus Facility");
  });

  it("does not call an abuse-icon designation an abusive facility", () => {
    const text = abuseIconConsumerExplanation("DESIGNATED");
    expect(text.toLowerCase()).not.toContain("abusive facility");
    expect(text.toLowerCase()).not.toContain("guilty of abuse");
    expect(text).toContain("abuse-icon designation");
  });

  it("does not treat missing current PI as confirmed closure", () => {
    const text = directoryStatusConsumerExplanation("ABSENT_FROM_CURRENT_DIRECTORY");
    expect(text).toContain("not proof the facility is closed");
  });

  it("does not label enrollment NPI as facility NPI", () => {
    expect(ENROLLMENT_NPI_LABEL.toLowerCase()).not.toContain("facility npi");
    expect(ENROLLMENT_NPI_LABEL).toContain("enrollment organization NPI");
  });

  it("keeps MDS measures distinct from star ratings", () => {
    expect(MDS_NOT_STAR_RATING).toContain("not the CMS quality-measure star rating");
  });
});
