/**
 * Shared local-API fetch plumbing (audit F3): every module client runs through
 * this wrapper so a hung sidecar request aborts after a bounded time instead
 * of leaving the UI spinning forever. The caller-provided fetcher (test mocks)
 * is preserved, as is any caller-supplied AbortSignal.
 */
export const LOCAL_REQUEST_TIMEOUT_MS = 30_000;

export function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = LOCAL_REQUEST_TIMEOUT_MS
) {
  if (init.signal) {
    // The caller already controls cancellation; just honor it.
    return fetcher(url, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return fetcher(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}
