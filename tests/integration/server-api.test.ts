import { mkdir } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { InMemoryJobStore, startTourServer } from "@tour/server";

import { withTempDir } from "../helpers";

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) {
      await close();
    }
  }
});

describe("server API", () => {
  it("serves job status, markdown, and meta", async () => {
    await withTempDir(async (tempDir) => {
      const staticDir = path.join(tempDir, "static");
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(staticDir, { recursive: true });
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });
      await Bun.write(path.join(staticDir, "index.html"), "<html><body>tour</body></html>");
      await Bun.write(path.join(artifactRoot, "slides", "tour.md"), "# slide\n");
      await Bun.write(
        path.join(artifactRoot, "meta", "job.json"),
        JSON.stringify({
          jobId: "job-1",
          status: "ready"
        })
      );

      const store = new InMemoryJobStore();
      store.create("job-1", artifactRoot);
      store.transition("job-1", "cloning", "clone");
      store.transition("job-1", "analyzing", "analyze");
      store.transition("job-1", "generating", "generate");
      store.transition("job-1", "validating", "validate");
      store.transition("job-1", "ready", "ready");

      const server = await startTourServer({ jobStore: store, staticDir, port: 0 });
      closers.push(server.close);

      const statusResponse = await fetch(`${server.url}/api/jobs/job-1/status`);
      expect(statusResponse.status).toBe(200);
      const statusPayload = (await statusResponse.json()) as { status: { state: string } };
      expect(statusPayload.status.state).toBe("ready");

      const markdownResponse = await fetch(`${server.url}/api/jobs/job-1/slides.md`);
      expect(markdownResponse.status).toBe(200);
      expect(await markdownResponse.text()).toContain("# slide");

      const metaResponse = await fetch(`${server.url}/api/jobs/job-1/meta`);
      expect(metaResponse.status).toBe(200);
      const metaPayload = (await metaResponse.json()) as { meta: { jobId: string } };
      expect(metaPayload.meta.jobId).toBe("job-1");
    });
  });
});
