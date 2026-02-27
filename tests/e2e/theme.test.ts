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

describe("theme e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase("uses JetBrains Mono and solarized light/dark via browser preference", async () => {
    await ensureWebBuild();

    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });

      await Bun.write(path.join(artifactRoot, "slides", "tour.md"), ["# Theme", "theme"].join("\n"));
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

      const expectations = [
        { colorScheme: "light" as const, bg: "#fdf6e3", ink: "#657b83" },
        { colorScheme: "dark" as const, bg: "#002b36", ink: "#839496" }
      ];

      for (const theme of expectations) {
        const page = await browser.newPage();
        await page.emulateMedia({ colorScheme: theme.colorScheme });
        await page.goto(`${server.url}/?jobId=job-1`);
        await page.waitForSelector("#slide-title");

        const actual = await page.evaluate(() => {
          const state = globalThis as unknown as { document: any; window: any };
          const root = state.window.getComputedStyle(state.document.documentElement);
          const body = state.window.getComputedStyle(state.document.body);
          const hasToggle = Boolean(state.document.querySelector("[data-theme-toggle], #theme-toggle, .theme-toggle"));

          return {
            bg: root.getPropertyValue("--bg").trim().toLowerCase(),
            ink: root.getPropertyValue("--ink").trim().toLowerCase(),
            fontFamily: body.fontFamily.toLowerCase(),
            hasToggle
          };
        });

        expect(actual.bg).toBe(theme.bg);
        expect(actual.ink).toBe(theme.ink);
        expect(actual.fontFamily).toContain("jetbrains mono");
        expect(actual.hasToggle).toBeFalse();

        await page.close();
      }

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
