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

describe("export actions e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase("exports markdown and triggers print", async () => {
    await ensureWebBuild();
    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });

      await Bun.write(
        path.join(artifactRoot, "slides", "tour.md"),
        ["# Architecture", "architecture", "", "---", "# Build and run setup", "setup", "", "---", "# Where to start", "entry point"].join("\n")
      );
      await Bun.write(path.join(artifactRoot, "meta", "job.json"), JSON.stringify({ jobId: "job-1" }));

      const store = new InMemoryJobStore();
      store.create("job-1", artifactRoot);
      store.transition("job-1", "cloning", "clone");
      store.transition("job-1", "analyzing", "analyze");
      store.transition("job-1", "generating", "generate");
      store.transition("job-1", "validating", "validate");
      store.transition("job-1", "ready", "ready");

      const staticDir = path.resolve(import.meta.dirname, "../../apps/web/dist");
      const server = await startTourServer({ jobStore: store, staticDir, port: 0 });
      closers.push(server.close);

      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`${server.url}/?jobId=job-1`);
      await page.waitForSelector("#save-md:not([disabled])");

      const downloadPromise = page.waitForEvent("download");
      await page.click("#save-md");
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain(".tour.md");

      await page.evaluate(() => {
        const state = globalThis as unknown as {
          print: () => void;
          __printed?: boolean;
        };
        state.print = () => {
          state.__printed = true;
        };
      });

      await page.click("#save-pdf");
      const wasPrinted = await page.evaluate(() => {
        const state = globalThis as unknown as { __printed?: boolean };
        return state.__printed ?? false;
      });
      expect(wasPrinted).toBeTrue();

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
