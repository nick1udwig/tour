import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "bun:test";

import { InMemoryJobStore, startTourServer } from "@tour/server";

import { withTempDir } from "../helpers";

const execFileAsync = promisify(execFile);
const PLAYWRIGHT_ENABLED = process.env.PLAYWRIGHT_E2E === "1";
let webBuilt = false;

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (closers.length > 0) {
    const close = closers.pop();
    if (close) {
      await close();
    }
  }
});

describe("full flow e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase("shows spinner then ready deck with snippet highlight and link", async () => {
    await ensureWebBuild();

    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });

      await Bun.write(
        path.join(artifactRoot, "slides", "tour.md"),
        [
          "# Architecture map",
          "architecture runtime flow",
          "",
          "```ts path=src/main.ts lines=1-3 permalink=https://github.com/openai/codex/blob/abc/src/main.ts#L1-L3",
          "const a = 1;",
          "const b = 2;",
          "console.log(a + b);",
          "```",
          "",
          "## Overview",
          "- Flow wiring",
          "",
          "## Line 2 commentary",
          "- add operation context",
          "",
          "---",
          "# Build and run setup",
          "build run setup",
          "",
          "---",
          "# Where to start",
          "entry point for bug fix"
        ].join("\n")
      );

      await Bun.write(path.join(artifactRoot, "meta", "job.json"), JSON.stringify({ jobId: "job-1" }));

      const store = new InMemoryJobStore();
      store.create("job-1", artifactRoot);
      store.transition("job-1", "cloning", "clone");
      store.transition("job-1", "analyzing", "analyze");
      store.transition("job-1", "generating", "generate");

      setTimeout(() => {
        store.transition("job-1", "validating", "validate");
        store.transition("job-1", "ready", "ready");
      }, 700);

      const staticDir = path.resolve(import.meta.dirname, "../../apps/web/dist");
      const server = await startTourServer({ jobStore: store, staticDir, port: 0 });
      closers.push(server.close);

      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`${server.url}/?jobId=job-1`);

      await page.waitForSelector("#spinner");
      await page.waitForSelector("#slide-title", { timeout: 6_000 });

      const linkHref = await page.getAttribute(".snippet-meta a", "href");
      expect(linkHref).toContain("/blob/abc/");

      const highlighted = await page.locator(".code-line.highlight").count();
      expect(highlighted).toBeGreaterThan(0);

      await browser.close();
    });
  });
});

async function ensureWebBuild(): Promise<void> {
  if (webBuilt) {
    return;
  }

  await execFileAsync("bun", ["run", "--cwd", "apps/web", "build"], {
    cwd: path.resolve(import.meta.dirname, "../..")
  });

  webBuilt = true;
}
