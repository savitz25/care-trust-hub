/**
 * Concurrent callers share one in-flight load.
 * A second caller must not get null just because init has not finished.
 */
export function createPosthogClientGate<T>(load: () => Promise<T | null>) {
  let client: T | null = null;
  let inflight: Promise<T | null> | null = null;

  async function get(): Promise<T | null> {
    if (client) return client;
    if (inflight) return inflight;
    inflight = Promise.resolve()
      .then(load)
      .then((instance) => {
        client = instance ?? null;
        if (!client) inflight = null;
        return client;
      })
      .catch(() => {
        client = null;
        inflight = null;
        return null;
      });
    return inflight;
  }

  function reset(): void {
    client = null;
    inflight = null;
  }

  return { get, reset };
}
