import { loadStateIndex } from "@/server/care/state-index";
import { StateIndexView } from "./state-index-view";

export async function StateIndexContent({
  stateCode,
  stateName,
}: {
  stateCode: string;
  stateName: string;
}) {
  const model = await loadStateIndex(stateCode, stateName);
  if (!model || model.facilities.length === 0) return null;
  return <StateIndexView model={model} />;
}
