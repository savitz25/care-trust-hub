"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { bindAnalyticsEnvironment, shouldEnablePosthog } from "@/lib/analytics/environment";
import { getPosthogBrowser } from "@/lib/analytics/posthog-browser";
import { captureSanitizedPageview } from "@/lib/analytics/trusthub";

function PosthogPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef("");

  useEffect(() => {
    if (!shouldEnablePosthog()) return;
    const path = pathname || "/";
    void getPosthogBrowser()
      .then((posthog) => {
        if (!posthog) return;
        if (lastPath.current === path) return;
        lastPath.current = path;
        captureSanitizedPageview(path, window.location.href);
      })
      .catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}

export function PosthogRoot({ environment }: { environment: string }) {
  bindAnalyticsEnvironment(environment);
  useEffect(() => {
    void getPosthogBrowser().catch(() => undefined);
  }, []);
  return <PosthogPageviews />;
}
