export function parseShortlistNames(value: string): { names: string[]; truncated: boolean } {
  const all = value
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  return { names: all.slice(0, 10), truncated: all.length > 10 };
}

export function parsePublicProviderSelection(value: string, maximum: number): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^[A-Z0-9]{6}$/.test(item)),
    ),
  ].slice(0, maximum);
}
