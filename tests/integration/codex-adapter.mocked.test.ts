import { describe, expect, it } from "bun:test";

import { generateWithCodex } from "@tour/core";

describe("codex adapter", () => {
  it("uses deterministic settings and returns model metadata", async () => {
    let capturedOptions: Record<string, unknown> | null = null;

    const output = await generateWithCodex(
      {
        prompt: "Generate markdown",
        workingDirectory: "/tmp",
        model: "gpt-5-codex"
      },
      {
        codexClient: {
          startThread(options) {
            capturedOptions = options;
            return {
              id: "thread-1",
              async run() {
                return {
                  finalResponse: "# Architecture\n\nBuild and run\n\nWhere to start",
                  usage: { total_tokens: 10 }
                };
              }
            };
          }
        }
      }
    );

    expect((capturedOptions as Record<string, unknown> | null)?.["model"]).toBe("gpt-5-codex");
    expect((capturedOptions as Record<string, unknown> | null)?.["modelReasoningEffort"]).toBe("minimal");
    expect(output.model.temperature).toBe(0);
    expect(output.model.packageVersion).toBe("0.106.0");
    expect(output.result.threadId).toBe("thread-1");
  });

  it("maps adapter errors to actionable messages", async () => {
    await expect(
      generateWithCodex(
        {
          prompt: "x",
          workingDirectory: "/tmp"
        },
        {
          codexClient: {
            startThread() {
              return {
                id: "thread-1",
                async run() {
                  throw new Error("Unauthorized");
                }
              };
            }
          }
        }
      )
    ).rejects.toThrow("CODEX_API_KEY");
  });
});
