import { describe, expect, it, vi } from "vitest";
import { generateCpaImageBytes } from "./local-cpa-image-client";

describe("generateCpaImageBytes", () => {
  it("reads base64 image data from an OpenAI-compatible image generation response", async () => {
    const imageBytes = Buffer.from("image-bytes");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: imageBytes.toString("base64") }] })
    })) as unknown as typeof fetch;

    const result = await generateCpaImageBytes("article-specific prompt", {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret",
      model: "gpt-image-2",
      fetchImpl: fetchMock
    });

    expect(Buffer.from(result).toString("utf8")).toBe("image-bytes");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8317/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" })
      })
    );
    const body = JSON.parse(String((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body));
    expect(body).toMatchObject({ model: "gpt-image-2", prompt: "article-specific prompt", n: 1 });
  });

  it("downloads image URL responses when the provider returns a URL", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/images/generations")) {
        return {
          ok: true,
          json: async () => ({ data: [{ url: "https://cdn.example/image.png" }] })
        } as Response;
      }
      return {
        ok: true,
        arrayBuffer: async () => Buffer.from("downloaded-image").buffer
      } as Response;
    }) as unknown as typeof fetch;

    const result = await generateCpaImageBytes("prompt", {
      baseUrl: "http://127.0.0.1:8317/v1",
      apiKey: "secret",
      model: "gpt-image-2",
      fetchImpl: fetchMock
    });

    expect(Buffer.from(result).includes(Buffer.from("downloaded-image"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.example/image.png",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
