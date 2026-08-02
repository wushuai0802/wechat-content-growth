import { describe, expect, it } from "vitest";
import { isAllowedLocalRequest } from "./local-request-guard";

describe("local request guard", () => {
  it("allows loopback browser and command requests", () => {
    expect(isAllowedLocalRequest({
      requestHostname: "127.0.0.1",
      hostHeader: "127.0.0.1:3002",
      originHeader: "http://127.0.0.1:3002"
    })).toBe(true);
    expect(isAllowedLocalRequest({
      requestHostname: "localhost",
      hostHeader: "localhost:3002",
      originHeader: null
    })).toBe(true);
  });

  it("rejects LAN hosts and external origins", () => {
    expect(isAllowedLocalRequest({
      requestHostname: "192.168.1.8",
      hostHeader: "192.168.1.8:3002",
      originHeader: null
    })).toBe(false);
    expect(isAllowedLocalRequest({
      requestHostname: "127.0.0.1",
      hostHeader: "127.0.0.1:3002",
      originHeader: "https://attacker.example"
    })).toBe(false);
  });
});
