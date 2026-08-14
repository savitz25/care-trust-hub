export function isDevelopmentDataEnabled(environment = process.env): boolean {
  return (
    environment.NODE_ENV !== "production" && environment.CARE_ENABLE_DEVELOPMENT_DATA === "true"
  );
}
