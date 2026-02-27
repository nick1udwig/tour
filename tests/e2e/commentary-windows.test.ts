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

describe("commentary windows e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase(
    "opens multiple draggable/resizable markdown comment windows",
    async () => {
      await ensureWebBuild();

    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });

      await Bun.write(
        path.join(artifactRoot, "slides", "tour.md"),
        [
          "# Architecture map",
          "Overall notes with `inline code` and **bold**.",
          "",
          "```ts path=src/main.ts lines=10-12 highlight=1,3 permalink=https://github.com/openai/codex/blob/abc/src/main.ts#L10-L12",
          "const a = 1;",
          "const b = 2;",
          "console.log(a + b);",
          "```",
          "",
          "- **Line 10** comment",
          "- [Line 12 link](https://example.com)",
          "",
          "---",
          "# Build and run setup",
          "setup"
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
      page.setDefaultTimeout(4_000);

      await page.goto(`${server.url}/?jobId=job-1`);
      await page.waitForSelector(".line-comment-trigger");

      expect(await page.locator(".line-comment-trigger").count()).toBe(2);
      await expect(await page.locator(".overall-toggle").count()).toBe(1);

      await page.locator(".line-comment-trigger").first().click();
      await page.waitForSelector(".comment-window");
      expect(await page.locator(".comment-window").count()).toBe(1);

      const firstWindowMarkup = await page.innerHTML(".comment-window-body");
      expect(firstWindowMarkup).toContain("<strong>Line 10</strong>");

      await page.evaluate(() => {
        const state = globalThis as unknown as { document: any };
        const triggers = state.document.querySelectorAll(".line-comment-trigger");
        triggers[1]?.click();
      });
      await page.waitForFunction(() => {
        const state = globalThis as unknown as { document: any };
        return state.document.querySelectorAll(".comment-window").length === 2;
      });
      expect(await page.locator(".comment-window").count()).toBe(2);

      const dragDelta = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; window: any; PointerEvent: any };
        const panel = state.document.querySelector(".comment-window");
        const handle = panel?.querySelector(".comment-window-titlebar");
        if (!panel || !handle) {
          throw new Error("missing draggable comment window");
        }

        const before = panel.getBoundingClientRect();
        const startX = before.left + 10;
        const startY = before.top + 10;

        handle.dispatchEvent(
          new state.PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: startX, clientY: startY })
        );
        state.window.dispatchEvent(
          new state.PointerEvent("pointermove", { bubbles: true, clientX: startX - 120, clientY: startY + 20 })
        );
        state.window.dispatchEvent(
          new state.PointerEvent("pointerup", { bubbles: true, clientX: startX - 120, clientY: startY + 20 })
        );

        const after = panel.getBoundingClientRect();
        return Math.abs(after.left - before.left) + Math.abs(after.top - before.top);
      });
      expect(dragDelta).toBeGreaterThan(10);

      const resizeDelta = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; window: any; PointerEvent: any };
        const panel = state.document.querySelector(".comment-window");
        const handle = panel?.querySelector(".comment-resize-handle");
        if (!panel || !handle) {
          throw new Error("missing resizable comment window");
        }

        const before = panel.getBoundingClientRect();
        const startX = before.right - 2;
        const startY = before.bottom - 2;

        handle.dispatchEvent(
          new state.PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: startX, clientY: startY })
        );
        state.window.dispatchEvent(
          new state.PointerEvent("pointermove", { bubbles: true, clientX: startX + 50, clientY: startY + 50 })
        );
        state.window.dispatchEvent(
          new state.PointerEvent("pointerup", { bubbles: true, clientX: startX + 50, clientY: startY + 50 })
        );

        const after = panel.getBoundingClientRect();
        return {
          width: after.width - before.width,
          height: after.height - before.height
        };
      });
      expect(resizeDelta.width).toBeGreaterThan(20);
      expect(resizeDelta.height).toBeGreaterThan(20);

      await page.evaluate(() => {
        const state = globalThis as unknown as { document: any };
        state.document.querySelector(".overall-toggle")?.click();
      });
      const commentsCollapsed = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any };
        const body = state.document.querySelector(".overall-comment-body");
        return body?.dataset.collapsed === "true";
      });
      expect(commentsCollapsed).toBeTrue();

      await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; PointerEvent: any };
        state.document.body.dispatchEvent(
          new state.PointerEvent("pointerdown", {
            bubbles: true,
            clientX: 5,
            clientY: 5
          })
        );
      });
      await page.waitForFunction(() => {
        const state = globalThis as unknown as { document: any };
        return state.document.querySelectorAll(".comment-window").length === 0;
      });
      expect(await page.locator(".comment-window").count()).toBe(0);

      await browser.close();
    });
    },
    20_000
  );
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
