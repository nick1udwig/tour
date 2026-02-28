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

describe("overview + multi-file e2e", () => {
  const testCase = PLAYWRIGHT_ENABLED ? it : it.skip;

  testCase("renders overview above code panes, expands on collapse, and uses full-file focus ranges", async () => {
    await ensureWebBuild();

    await withTempDir(async (tempDir) => {
      const artifactRoot = path.join(tempDir, "job");
      await mkdir(path.join(artifactRoot, "slides"), { recursive: true });
      await mkdir(path.join(artifactRoot, "meta"), { recursive: true });
      await mkdir(path.join(artifactRoot, "repo", "src"), { recursive: true });

      await Bun.write(
        path.join(artifactRoot, "repo", "src", "alpha.ts"),
        [
          "export function alpha(flag: boolean): number {",
          "  if (!flag) {",
          "    return 0;",
          "  }",
          "  const base = 40;",
          "  return base + 2;",
          "}",
          ""
        ].join("\n")
      );

      await Bun.write(
        path.join(artifactRoot, "repo", "src", "beta.ts"),
        [
          "export function beta(input: number): string {",
          "  const normalized = input.toString();",
          "  if (normalized.length > 8) {",
          "    return normalized.slice(0, 8);",
          "  }",
          "  const padded = normalized.padStart(8, \"0\");",
          "  return padded;",
          "}",
          ""
        ].join("\n")
      );

      await Bun.write(
        path.join(artifactRoot, "slides", "tour.md"),
        [
          "# Architecture map",
          "## Overview",
          "- Cross-file flow for request normalization and fallback values.",
          "",
          "```ts path=src/alpha.ts lines=3-4 permalink=https://github.com/openai/codex/blob/abc/src/alpha.ts#L3-L4",
          "    return 0;",
          "  }",
          "```",
          "",
          "## Line 3 commentary",
          "- Guard branch determines downstream fan-out behavior.",
          "",
          "```ts path=src/beta.ts lines=6-7 permalink=https://github.com/openai/codex/blob/abc/src/beta.ts#L6-L7",
          "  const padded = normalized.padStart(8, \"0\");",
          "  return padded;",
          "```",
          "",
          "## Lines 6-7 commentary",
          "- Padded value shape is consumed by multiple modules.",
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
      page.setDefaultTimeout(4_000);

      await page.goto(`${server.url}/?jobId=job-1`);
      await page.waitForSelector(".snippet", { state: "attached" });

      const deckSummary = await page.evaluate(() => {
        const state = globalThis as unknown as { document: any; window: any };
        const overview = state.document.querySelector(".slide-overview");
        const snippets = Array.from(state.document.querySelectorAll(".snippet")) as Array<{
          getBoundingClientRect: () => { height: number };
        }>;
        const firstSnippetRows = state.document.querySelectorAll(".snippet")[0]?.querySelectorAll(".code-line") ?? [];
        const firstFocusedRows = state.document.querySelectorAll(".snippet")[0]?.querySelectorAll(".code-line.focused") ?? [];
        const secondFocusedRows = state.document.querySelectorAll(".snippet")[1]?.querySelectorAll(".code-line.focused") ?? [];

        return {
          hasOverview: Boolean(overview),
          firstChildClass: state.document.querySelector(".slide-layout")?.firstElementChild?.className ?? "",
          snippetCount: snippets.length,
          firstSnippetRowCount: firstSnippetRows.length,
          firstFocusedRows: firstFocusedRows.length,
          secondFocusedRows: secondFocusedRows.length,
          heightDelta: Math.abs(
            (snippets[0]?.getBoundingClientRect().height ?? 0) -
              (snippets[1]?.getBoundingClientRect().height ?? 0)
          )
        };
      });

      expect(deckSummary.hasOverview).toBeTrue();
      expect(deckSummary.firstChildClass).toContain("slide-overview");
      expect(deckSummary.snippetCount).toBe(2);
      expect(deckSummary.firstSnippetRowCount).toBe(7);
      expect(deckSummary.firstFocusedRows).toBe(2);
      expect(deckSummary.secondFocusedRows).toBe(2);
      expect(deckSummary.heightDelta).toBeLessThan(60);

      const beforeCollapse = await page.locator(".snippet").first().boundingBox();
      await page.click(".slide-overview-toggle");
      await page.waitForTimeout(280);
      const collapsedState = await page.getAttribute(".slide-overview-body", "data-collapsed");
      const afterCollapse = await page.locator(".snippet").first().boundingBox();

      expect(collapsedState).toBe("true");
      expect((afterCollapse?.height ?? 0) - (beforeCollapse?.height ?? 0)).toBeGreaterThan(2);

      await browser.close();
    });
  }, 20_000);
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
