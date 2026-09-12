import { getSeniorNetworkMetrics } from "@/server/care/senior-network-metrics";

/** Specialist-owned contract; publication flags and source grains remain explicit. */
export function GET() {
  return Response.json(getSeniorNetworkMetrics(), {
    headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
