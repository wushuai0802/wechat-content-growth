import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = join(root, ".next", "standalone");
const serverFile = join(standaloneDir, "server.js");

if (!existsSync(serverFile)) {
  throw new Error("Missing standalone build. Run `npm run build` before `npm run test:smoke`.");
}

function copyRuntimeAssets() {
  const staticSource = join(root, ".next", "static");
  const staticTarget = join(standaloneDir, ".next", "static");
  const publicSource = join(root, "public");
  const publicTarget = join(standaloneDir, "public");

  if (existsSync(staticSource)) {
    mkdirSync(dirname(staticTarget), { recursive: true });
    cpSync(staticSource, staticTarget, { recursive: true, force: true });
  }

  if (existsSync(publicSource)) {
    cpSync(publicSource, publicTarget, { recursive: true, force: true });
  }
}

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

async function waitForResponse(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

copyRuntimeAssets();
const port = await availablePort();
const dataRoot = mkdtempSync(join(tmpdir(), "wechat-content-growth-smoke-"));
const child = spawn(process.execPath, [serverFile], {
  cwd: standaloneDir,
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    WCG_PROJECT_ROOT: root,
    WCG_DATA_ROOT: dataRoot
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => { output += chunk.toString(); });
child.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForResponse(`${baseUrl}/`);

  const workspaceResponse = await waitForResponse(`${baseUrl}/api/workspace`);
  const workspace = await workspaceResponse.json();
  if (!Array.isArray(workspace.topics) || !Array.isArray(workspace.articles)) {
    throw new Error("Workspace smoke response is missing topics or articles arrays");
  }

  const providerResponse = await waitForResponse(`${baseUrl}/api/cpa/provider/config`);
  const provider = await providerResponse.json();
  if (typeof provider.configured !== "boolean") {
    throw new Error("Provider config smoke response is invalid");
  }

  console.log(`Smoke test passed on ${baseUrl}`);
} catch (error) {
  if (output.trim()) console.error(output.trim());
  throw error;
} finally {
  child.kill();
  rmSync(dataRoot, { recursive: true, force: true });
}
