import { NextResponse, type NextRequest } from "next/server";
import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const redirectHosts = new Set(["seniortrusthub.com", "care-trust-hub.vercel.app"]);

export function proxy(request: NextRequest) {
  const statePath = normalizedPublishedStatePath(request.nextUrl.pathname);
  if (statePath) {
    const url = request.nextUrl.clone();
    url.pathname = statePath;
    return NextResponse.redirect(url, 308);
  }
  if (!isPublicLaunchEnabled() || !redirectHosts.has(request.nextUrl.hostname))
    return NextResponse.next();
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    productionOrigin,
  );
  return NextResponse.redirect(destination, 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
