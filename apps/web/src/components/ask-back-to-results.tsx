import Link from "next/link";
import type { SeniorAskSearchContext } from "@care/domain";
import { buildAskBackLabel, buildAskSearchHref } from "@care/domain";

export function AskBackToResults({ context }: { context: SeniorAskSearchContext }) {
  if (context.unsupported) return null;
  return (
    <p className="methodology-note">
      <Link className="button button--quiet" href={buildAskSearchHref(context)}>
        {buildAskBackLabel(context)}
      </Link>
    </p>
  );
}
