import { mkdir } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { orchestrateTour } from "../../packages/cli/src/orchestrator";

import { withTempDir } from "../helpers";

afterEach(() => {
  delete process.env.TOUR_NO_KEEPALIVE;
});

describe("failure paths", () => {
  it("returns non-zero and preserves logs for clone/model/schema failures", async () => {
    await withTempDir(async (tempDir) => {
      process.env.TOUR_NO_KEEPALIVE = "1";

      const localRepo = path.join(tempDir, "repo");
      await mkdir(localRepo, { recursive: true });
      await Bun.write(path.join(localRepo, "index.ts"), "export const x = 1;\n");

      const run = async (mode: "clone" | "model" | "schema") =>
        orchestrateTour(
          {
            githubUrl: "https://github.com/openai/codex",
            open: false,
            out: tempDir
          },
          {
            cloneRepository:
              mode === "clone"
                ? (async () => {
                    throw new Error("clone failed");
                  })
                : async () => ({
                    owner: "openai",
                    repo: "codex",
                    cloneUrl: "",
                    htmlUrl: "https://github.com/openai/codex",
                    branch: "main",
                    commitSha: "abc",
                    localPath: localRepo
                  }),
            generateWithCodex:
              mode === "model"
                ? (async () => {
                    throw new Error("model failed");
                  })
                : async () => ({
                    result: {
                      markdown:
                        mode === "schema"
                          ? "# Intro\nno required sections"
                          : "# Architecture\nsetup run\nwhere to start",
                      usage: null,
                      threadId: "thread"
                    },
                    model: {
                      provider: "codex-sdk",
                      package: "@openai/codex-sdk",
                      packageVersion: "0.106.0",
                      model: "gpt-5.3-codex",
                      temperature: 0,
                      modelReasoningEffort: "medium"
                    }
                  }),
            startTourServer: async () => ({
              url: "http://127.0.0.1:4000",
              port: 4000,
              close: async () => {}
            })
          }
        );

      const cloneFailure = await run("clone");
      const modelFailure = await run("model");
      const schemaFailure = await run("schema");

      expect(cloneFailure.exitCode).toBe(1);
      expect(modelFailure.exitCode).toBe(1);
      expect(schemaFailure.exitCode).toBe(1);

      expect(await Bun.file(path.join(cloneFailure.runRoot, "logs", "generation.log")).exists()).toBeTrue();
      expect(await Bun.file(path.join(modelFailure.runRoot, "logs", "generation.log")).exists()).toBeTrue();
      expect(await Bun.file(path.join(schemaFailure.runRoot, "logs", "generation.log")).exists()).toBeTrue();
    });
  });
});
