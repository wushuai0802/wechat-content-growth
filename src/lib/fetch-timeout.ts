export function withFetchTimeout(init: RequestInit | undefined, timeoutMs: number): RequestInit {
  if (init?.signal) return init;
  return {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  };
}
