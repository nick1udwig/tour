import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { JobMetaResponse, JobStatusResponse } from "@tour/shared";

import { InMemoryJobStore } from "./jobs";

interface StartServerOptions {
  jobStore: InMemoryJobStore;
  staticDir: string;
  port?: number;
  host?: string;
}

export async function startTourServer(options: StartServerOptions): Promise<{
  url: string;
  port: number;
  close: () => Promise<void>;
}> {
  const host = options.host ?? "127.0.0.1";

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? host}`);
      const pathname = url.pathname;

      if (pathname.startsWith("/api/jobs/")) {
        await handleApiRequest(pathname, options.jobStore, res);
        return;
      }

      await handleStaticRequest(pathname, options.staticDir, res);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error)
        })
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a usable address");
  }

  return {
    url: `http://${host}:${address.port}`,
    port: address.port,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

async function handleApiRequest(pathname: string, jobStore: InMemoryJobStore, res: import("node:http").ServerResponse): Promise<void> {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 4) {
    writeJson(res, 404, { error: "Not found" });
    return;
  }

  const [, , jobId, resource] = parts;
  const status = jobStore.getStatus(jobId);

  if (!status) {
    writeJson(res, 404, { error: `Unknown job: ${jobId}` });
    return;
  }

  if (resource === "status") {
    const payload: JobStatusResponse = { status };
    writeJson(res, 200, payload);
    return;
  }

  if (resource === "slides.md") {
    const slidePath = path.join(status.artifactRoot, "slides", "tour.md");
    const markdown = await readFile(slidePath, "utf8");
    res.statusCode = 200;
    res.setHeader("content-type", "text/markdown; charset=utf-8");
    res.end(markdown);
    return;
  }

  if (resource === "meta") {
    const metaPath = path.join(status.artifactRoot, "meta", "job.json");
    const rawMeta = await readFile(metaPath, "utf8");
    const payload: JobMetaResponse = {
      status,
      meta: JSON.parse(rawMeta)
    };
    writeJson(res, 200, payload);
    return;
  }

  writeJson(res, 404, { error: "Not found" });
}

async function handleStaticRequest(pathname: string, staticDir: string, res: import("node:http").ServerResponse): Promise<void> {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const resolved = path.resolve(staticDir, safePath);

  if (!resolved.startsWith(path.resolve(staticDir))) {
    writeJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await readFile(resolved);
    res.statusCode = 200;
    res.setHeader("content-type", contentTypeForFile(resolved));
    res.end(content);
  } catch {
    const fallback = path.resolve(staticDir, "index.html");

    try {
      const content = await readFile(fallback);
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(content);
    } catch {
      writeJson(res, 404, { error: "Not found" });
    }
  }
}

function contentTypeForFile(filePath: string): string {
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }

  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (filePath.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }

  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  return "application/octet-stream";
}

function writeJson(res: import("node:http").ServerResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

export * from "./jobs";
