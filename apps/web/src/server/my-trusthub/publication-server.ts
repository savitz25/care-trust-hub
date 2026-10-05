import "server-only";
import { productionOrigin } from "@/config/deployment";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import {
  SeniorCustomerValidationError,
  getSeniorClaimProfile,
} from "@/server/care/senior-customer-profile-validation";
import type { ProfileReader } from "./publication";

/** Production publication read: the current public CMS nursing-home profile
 * for a CCN, re-proved through the customer-profile validation contract. */
export const seniorProfileReader: ProfileReader = {
  async nursingHomeByCcn(ccn) {
    if (!isRealProviderUiEnabled()) return null;
    try {
      const profile = await getSeniorClaimProfile("nursing_home", ccn);
      if (!profile || profile.providerClass !== "nursing_home") return null;
      const url = new URL(profile.canonicalProfileUrl);
      if (url.origin !== productionOrigin.origin || url.search || url.hash) return null;
      return { ccn: profile.cmsCcn, canonicalPath: url.pathname };
    } catch (error) {
      // Held, historical or mismatched profiles are simply not eligible.
      if (error instanceof SeniorCustomerValidationError && error.code !== "backend_unavailable")
        return null;
      throw error;
    }
  },
};
