import { describe, expect, it } from "bun:test";

import { generateWithCodex } from "@tour/core";

describe("codex adapter", () => {
  it("defaults to gpt-5.3-codex and medium reasoning effort", async () => {
    let capturedOptions: Record<string, unknown> | null = null;

    const output = await generateWithCodex(
      {
        prompt: "Generate markdown",
        workingDirectory: "/tmp"
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

    expect((capturedOptions as Record<string, unknown> | null)?.["model"]).toBe("gpt-5.3-codex");
    expect((capturedOptions as Record<string, unknown> | null)?.["modelReasoningEffort"]).toBe("medium");
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

  it("maps unsupported reasoning effort errors to guided remediation", async () => {
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
                  throw new Error(
                    "{\"error\":{\"message\":\"Unsupported value: 'minimal' is not supported with the 'gpt-5-codex' model. Supported values are: 'low', 'medium', and 'high'.\",\"param\":\"reasoning.effort\"}}"
                  );
                }
              };
            }
          }
        }
      )
    ).rejects.toThrow("--reasoning-effort");
  });
});
