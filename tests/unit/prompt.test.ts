import { describe, expect, it } from "bun:test";

import { composePrompt } from "@tour/core";

describe("prompt composer", () => {
  it("builds versioned prompt and stable hash", async () => {
    const manifest = {
      version: "v1",
      repo: {
        owner: "openai",
        repo: "codex",
        branch: "main",
        commitSha: "abc"
      },
      files: [
        {
          path: "src/index.ts",
          sizeBytes: 20,
          digest: "123",
          content: "export const x = 1;"
        }
      ]
    };

    const first = await composePrompt({ manifest, maxDurationMinutes: 60 });
    const second = await composePrompt({ manifest, maxDurationMinutes: 60 });

    expect(first.version).toBe("tour-v1");
    expect(first.prompt).toContain("Repository orientation and architecture map");
    expect(first.sha256).toBe(second.sha256);
  });

  it("does not embed repository files directly in the prompt", async () => {
    const manifest = {
      version: "v1",
      repo: {
        owner: "openai",
        repo: "codex",
        branch: "main",
        commitSha: "abc"
      },
      files: [
        {
          path: "src/index.ts",
          sizeBytes: 20,
          digest: "123",
          content: "export const x = 1;"
        }
      ]
    };

    const bundle = await composePrompt({ manifest, maxDurationMinutes: 60 });
    expect(bundle.prompt).not.toContain("FILE: src/index.ts");
    expect(bundle.prompt).not.toContain("export const x = 1;");
  });
});
