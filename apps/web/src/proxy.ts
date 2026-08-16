import { NextResponse, type NextRequest } from "next/server";
import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";

const redirectHosts = new Set(["seniortrusthub.com", "care-trust-hub.vercel.app"]);

export function proxy(request: NextRequest) {
  if (!isPublicLaunchEnabled() || !redirectHosts.has(request.nextUrl.hostname))
    return NextResponse.next();
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    productionOrigin,
  );
  return NextResponse.redirect(destination, 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
