export const productionOrigin = new URL("https://www.seniortrusthub.com");

export function isVercelProduction(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.VERCEL_ENV === "production";
}

export function isPublicLaunchEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return isVercelProduction(environment) && environment.CARE_ENABLE_PUBLIC_LAUNCH === "true";
}

export function canonicalUrl(
  pathname: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  if (!isPublicLaunchEnabled(environment)) return undefined;
  return new URL(pathname, productionOrigin).href;
}

export function publicRobots(
  indexable: boolean,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const launch = isPublicLaunchEnabled(environment);
  return { index: launch && indexable, follow: launch && indexable };
}
