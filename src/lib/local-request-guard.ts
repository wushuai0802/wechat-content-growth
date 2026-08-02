const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function hostnameFromHostHeader(value: string | null): string {
  if (!value) return "";
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return "";
  }
}

export function isLoopbackHostname(value: string): boolean {
  return loopbackHosts.has(value.toLowerCase());
}

export function isAllowedLocalRequest(input: {
  requestHostname: string;
  hostHeader: string | null;
  originHeader: string | null;
}): boolean {
  if (!isLoopbackHostname(input.requestHostname)) return false;
  const host = hostnameFromHostHeader(input.hostHeader);
  if (!isLoopbackHostname(host)) return false;
  if (!input.originHeader) return true;

  try {
    return isLoopbackHostname(new URL(input.originHeader).hostname);
  } catch {
    return false;
  }
}
