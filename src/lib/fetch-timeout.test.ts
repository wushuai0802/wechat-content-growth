import { describe, expect, it } from "vitest";
import { withFetchTimeout } from "./fetch-timeout";

describe("withFetchTimeout", () => {
  it("adds a timeout signal without replacing an explicit signal", () => {
    expect(withFetchTimeout({ method: "GET" }, 1000).signal).toBeInstanceOf(AbortSignal);
    const controller = new AbortController();
    expect(withFetchTimeout({ signal: controller.signal }, 1000).signal).toBe(controller.signal);
  });
});
