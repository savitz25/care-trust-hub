export function safeBusinessWebsite(value?: string | null) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function claimRedirect(token: string) {
  const origin = (process.env.ATH_CUSTOMER_ORIGIN || "https://www.asktrusthub.com").replace(
    /\/+$/,
    "",
  );
  const url = new URL("/claim/continue", origin);
  url.searchParams.set("handoff", token);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
