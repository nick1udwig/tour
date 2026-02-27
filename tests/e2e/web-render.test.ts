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
          "```ts path=src/index.ts lines=3-5 highlight=2 permalink=https://github.com/openai/codex/blob/abc/src/index.ts#L3-L5",
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
        const state = globalThis as unknown as { document: any; window: { innerWidth: number } };
        const shell = state.document.querySelector(".app-shell") as
          | { getBoundingClientRect: () => { width: number } }
          | null;
        if (!shell) {
          throw new Error("Missing .app-shell");
        }
        const rect = shell.getBoundingClientRect();
        return rect.width / state.window.innerWidth;
      });
      expect(usage).toBeGreaterThan(0.95);

      const controls = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; window: { innerWidth: number } };
        const bar = state.document.querySelector(".controls") as
          | {
              getBoundingClientRect: () => { top: number; right: number };
              querySelectorAll: (selector: string) => Array<{ textContent?: string | null }>;
            }
          | null;
        if (!bar) {
          throw new Error("Missing .controls");
        }

        const bounds = bar.getBoundingClientRect();
        const buttons = Array.from(bar.querySelectorAll("button"));
        const iconOnly = buttons.every((button) => button.textContent?.trim().length === 0);

        return {
          top: bounds.top,
          rightGap: state.window.innerWidth - bounds.right,
          hasSavePdf: Boolean(state.document.querySelector("#save-pdf")),
          iconOnly
        };
      });
      expect(controls.top).toBeLessThan(100);
      expect(controls.rightGap).toBeLessThan(80);
      expect(controls.hasSavePdf).toBeFalse();
      expect(controls.iconOnly).toBeTrue();

      const deckLayout = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; window: any };
        const deck = state.document.querySelector(".deck") as { getBoundingClientRect: () => { height: number } } | null;
        const snippet = state.document.querySelector(".snippet");
        if (!deck || !snippet) {
          throw new Error("Missing slide elements");
        }

        const deckStyle = state.window.getComputedStyle(deck);
        const snippetStyle = state.window.getComputedStyle(snippet);
        const deckBounds = deck.getBoundingClientRect();

        return {
          deckBorder: Number.parseFloat(deckStyle.borderTopWidth),
          snippetBorder: Number.parseFloat(snippetStyle.borderTopWidth),
          deckHeightUsage: deckBounds.height / state.window.innerHeight
        };
      });
      expect(deckLayout.deckBorder).toBe(0);
      expect(deckLayout.snippetBorder).toBe(0);
      expect(deckLayout.deckHeightUsage).toBeGreaterThan(0.7);

      const lineNumbers = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any };
        const first = state.document.querySelector(".line-no");
        const all = Array.from(state.document.querySelectorAll(".line-no")) as Array<{ textContent?: string | null }>;
        const last = all.at(-1);
        return {
          first: first?.textContent?.trim(),
          last: last?.textContent?.trim()
        };
      });
      expect(lineNumbers.first).toBe("3");
      expect(lineNumbers.last).toBe("5");

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
