import type { Metadata } from "next";
import { ShortlistTool } from "./shortlist-tool";
import { SyntheticDataNotice } from "@/components/evidence";

export const metadata: Metadata = {
  title: "Research a hospital shortlist",
  description: "Compare several fictional care facilities using transparent synthetic evidence.",
};

export default function ShortlistPage() {
  return (
    <div className="page-shell narrow-shell">
      <SyntheticDataNotice />
      <header className="page-intro">
        <p className="eyebrow">Crisis shortlist</p>
        <h1>Got a shortlist from the hospital?</h1>
        <p className="lede">
          Enter the facility names you were given. We’ll help you compare the public record.
        </p>
      </header>
      <ShortlistTool />
      <aside className="editorial-note">
        <strong>We don’t tell you which facility to choose.</strong>
        <p>
          We organize the evidence so you can ask better questions. Name matching shown here is a
          prototype and is not production-grade.
        </p>
      </aside>
    </div>
  );
}
