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

describe("web render e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase("renders deck and supports navigation", async () => {
    await ensureWebBuild();
    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });

      await Bun.write(
        path.join(artifactRoot, "slides", "tour.md"),
        [
          "# Architecture map",
          "architecture and runtime flow",
          "",
          "```ts path=src/index.ts lines=1-3 highlight=2 permalink=https://github.com/openai/codex/blob/abc/src/index.ts#L1-L3",
          "const a = 1;",
          "const b = 2;",
          "console.log(a + b);",
          "```",
          "",
          "---",
          "# Build and run setup",
          "build run setup"
        ].join("\n")
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
      await page.waitForSelector("#slide-title");

      const usage = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>(".app-shell");
        if (!shell) {
          throw new Error("Missing .app-shell");
        }
        const rect = shell.getBoundingClientRect();
        return rect.width / window.innerWidth;
      });
      expect(usage).toBeGreaterThan(0.95);

      const controls = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>(".controls");
        if (!bar) {
          throw new Error("Missing .controls");
        }

        const bounds = bar.getBoundingClientRect();
        const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>("button"));
        const iconOnly = buttons.every((button) => button.textContent?.trim().length === 0);

        return {
          top: bounds.top,
          rightGap: window.innerWidth - bounds.right,
          hasSavePdf: Boolean(document.querySelector("#save-pdf")),
          iconOnly
        };
      });
      expect(controls.top).toBeLessThan(100);
      expect(controls.rightGap).toBeLessThan(80);
      expect(controls.hasSavePdf).toBeFalse();
      expect(controls.iconOnly).toBeTrue();

      const deckLayout = await page.evaluate(() => {
        const deck = document.querySelector<HTMLElement>(".deck");
        const snippet = document.querySelector<HTMLElement>(".snippet");
        if (!deck || !snippet) {
          throw new Error("Missing slide elements");
        }

        const deckStyle = window.getComputedStyle(deck);
        const snippetStyle = window.getComputedStyle(snippet);
        const deckBounds = deck.getBoundingClientRect();

        return {
          deckBorder: Number.parseFloat(deckStyle.borderTopWidth),
          snippetBorder: Number.parseFloat(snippetStyle.borderTopWidth),
          deckHeightUsage: deckBounds.height / window.innerHeight
        };
      });
      expect(deckLayout.deckBorder).toBe(0);
      expect(deckLayout.snippetBorder).toBe(0);
      expect(deckLayout.deckHeightUsage).toBeGreaterThan(0.7);

      await expect(await page.textContent("#slide-title")).toContain("Architecture map");
      await page.click("#next-slide");
      await expect(await page.textContent("#slide-title")).toContain("Build and run setup");

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
