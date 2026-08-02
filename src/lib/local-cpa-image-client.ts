export interface CpaImageGenerationOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  size?: string;
}

interface ImageGenerationResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export async function generateCpaImageBytes(
  prompt: string,
  options: CpaImageGenerationOptions
): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/images/generations`, withFetchTimeout({
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      size: options.size ?? "1024x1024",
      n: 1
    })
  }, 900_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`CPA image generation failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as ImageGenerationResponse;
  const image = data.data?.[0];
  if (image?.b64_json) {
    return Buffer.from(image.b64_json, "base64");
  }
  if (image?.url) {
    const imageResponse = await fetchImpl(image.url, withFetchTimeout(undefined, 60_000));
    if (!imageResponse.ok) {
      throw new Error(`CPA image download failed: ${imageResponse.status}`);
    }
    return new Uint8Array(await imageResponse.arrayBuffer());
  }

  throw new Error("CPA image generation returned no image data");
}
import { withFetchTimeout } from "./fetch-timeout";
