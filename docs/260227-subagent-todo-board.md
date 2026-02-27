# Codebase Tour MVP - Subagent TODO Board

Date: 2026-02-27  
Board status: Ready  
Source plan: `docs/260227-implementation-plan.md`

## Working Agreement

- Keep changes scoped to the task card.
- Do not modify acceptance criteria without updating this board.
- Update task status in this file when starting/completing work.
- Link resulting PR or commit hash under the task.
- If blocked, set status to `blocked` with reason.

Status values:
- `todo`
- `in_progress`
- `blocked`
- `done`

## Global Conventions

- Package manager: Bun.
- Language: TypeScript across backend and frontend.
- Frontend: Vite.
- Output root: `TOUR_HOME` or default `~/.tour`.
- Output folder shape: `<root>/<owner>/<repo>/<YYYYMMDD-HHmmssZ>/`.
- Public GitHub repositories only for MVP.

## Task Cards

### T001 - Workspace Scaffold

- Status: `done`
- Owner: `subagent-platform`
- Depends on: none
- Scope:
  - Initialize Bun workspace layout with `apps/web`, `packages/cli`, `packages/core`, `packages/server`, `packages/shared`.
  - Add base TypeScript config and package scripts.
- Deliverables:
  - Root `package.json` with Bun workspaces.
  - Root `tsconfig` and package-level configs.
  - Minimal lint/test script wiring.
- Acceptance criteria:
  - `bun install` succeeds.
  - `bun run test` executes placeholder tests.
  - `bun run typecheck` succeeds.
- Suggested files:
  - `package.json`
  - `bunfig.toml`
  - `tsconfig.base.json`
  - `apps/web/*`
  - `packages/*`

### T002 - Shared Types and Constants

- Status: `done`
- Owner: `subagent-core`
- Depends on: T001
- Scope:
  - Define shared types for job states, artifacts, slide metadata, and API responses.
  - Define constants for default paths and timestamp format.
- Deliverables:
  - `packages/shared/src/types.ts`
  - `packages/shared/src/constants.ts`
- Acceptance criteria:
  - Types imported by both CLI and server without duplication.
  - Job states include: queued, cloning, analyzing, generating, validating, ready, failed.

### T003 - CLI Argument Parsing

- Status: `done`
- Owner: `subagent-cli`
- Depends on: T001, T002
- Scope:
  - Implement `tour <github-url>` and flags:
    - `--branch`
    - `--port`
    - `--open`
    - `--out`
    - `--model`
    - `--max-duration`
- Deliverables:
  - `packages/cli/src/index.ts`
  - `packages/cli/src/args.ts`
- Acceptance criteria:
  - Invalid GitHub URL returns non-zero exit.
  - Missing URL shows help text.
  - Parsed options are passed to orchestration layer.

### T004 - Output Path Resolution

- Status: `done`
- Owner: `subagent-core`
- Depends on: T002
- Scope:
  - Implement root resolution logic:
    - `TOUR_HOME` env overrides default.
    - default root is `~/.tour`.
  - Build per-run path with `<owner>/<repo>/<timestamp>`.
- Deliverables:
  - `packages/core/src/paths.ts`
  - Unit tests in `tests/unit/paths.test.ts`
- Acceptance criteria:
  - Timestamp formatted as `YYYYMMDD-HHmmssZ`.
  - Paths are normalized cross-platform.

### T005 - GitHub Repo Resolver and Clone

- Status: `done`
- Owner: `subagent-core`
- Depends on: T003, T004
- Scope:
  - Parse owner/repo from URL.
  - Resolve default branch when `--branch` absent.
  - Clone repo into job artifact path and pin commit SHA.
- Deliverables:
  - `packages/core/src/repo.ts`
  - `tests/integration/repo-resolver.test.ts`
- Acceptance criteria:
  - Branch fallback to default works.
  - Commit SHA captured in metadata.
  - Non-existent branch fails with clear message.

### T006 - Job State Machine

- Status: `done`
- Owner: `subagent-server`
- Depends on: T002, T003
- Scope:
  - Implement lifecycle transitions and in-memory state store.
  - Persist phase logs and terminal status.
- Deliverables:
  - `packages/server/src/jobs.ts`
  - `tests/unit/job-state.test.ts`
- Acceptance criteria:
  - Illegal transitions are rejected.
  - Failure state stores reason and phase.

### T007 - Deterministic Context Builder

- Status: `done`
- Owner: `subagent-core`
- Depends on: T005
- Scope:
  - Select files for analysis with stable ordering and exclusion rules.
  - Emit context manifest used for generation.
- Deliverables:
  - `packages/core/src/context-builder.ts`
  - `tests/unit/context-builder.test.ts`
- Acceptance criteria:
  - Repeated runs on same repo+sha produce byte-identical context manifest.
  - Binary and large generated files excluded.

### T008 - Prompt Composer

- Status: `done`
- Owner: `subagent-core`
- Depends on: T007
- Scope:
  - Build versioned prompt template for Codex SDK.
  - Include architecture + pragmatic setup requirements and max duration goals.
- Deliverables:
  - `packages/core/src/prompt.ts`
  - `packages/core/prompts/tour-v1.txt`
  - `tests/unit/prompt.test.ts`
- Acceptance criteria:
  - Prompt version and hash persisted in metadata.
  - Prompt includes mandatory slide requirements.

### T009 - Codex SDK Adapter

- Status: `done`
- Owner: `subagent-ai`
- Depends on: T008
- Scope:
  - Integrate Codex SDK invocation with deterministic settings.
  - Support optional model override.
- Deliverables:
  - `packages/core/src/codex-adapter.ts`
  - `tests/integration/codex-adapter.mocked.test.ts`
- Acceptance criteria:
  - Temperature is set to deterministic mode.
  - Model identifier/version stored in metadata.
  - Adapter errors are mapped to actionable messages.

### T010 - Markdown Contract and Validator

- Status: `done`
- Owner: `subagent-core`
- Depends on: T009
- Scope:
  - Define markdown schema rules for required slide categories and snippet metadata.
  - Validate generated markdown and normalize formatting.
- Deliverables:
  - `packages/core/src/markdown-schema.ts`
  - `packages/core/src/markdown-normalize.ts`
  - `tests/unit/markdown-schema.test.ts`
- Acceptance criteria:
  - Missing required sections fail validation.
  - Normalized output is deterministic.

### T011 - GitHub Permalink Generator

- Status: `done`
- Owner: `subagent-core`
- Depends on: T005, T010
- Scope:
  - Generate commit-pinned file and line links for code snippets.
  - Graceful fallback for invalid line ranges.
- Deliverables:
  - `packages/core/src/permalink.ts`
  - `tests/unit/permalink.test.ts`
- Acceptance criteria:
  - URL format uses `blob/<sha>/<path>#Lx-Ly`.
  - Fallback links still point to exact commit SHA.

### T012 - Artifact Writer and Metadata

- Status: `done`
- Owner: `subagent-core`
- Depends on: T004, T009, T010
- Scope:
  - Persist generated markdown, normalized markdown, context, prompt, model info, logs.
- Deliverables:
  - `packages/core/src/artifacts.ts`
  - `tests/unit/artifacts.test.ts`
- Acceptance criteria:
  - Artifact layout matches plan.
  - Missing write paths produce clear errors.

### T013 - Local Server API

- Status: `done`
- Owner: `subagent-server`
- Depends on: T006, T012
- Scope:
  - Implement endpoints:
    - `/api/jobs/:jobId/status`
    - `/api/jobs/:jobId/slides.md`
    - `/api/jobs/:jobId/meta`
  - Serve static frontend assets.
- Deliverables:
  - `packages/server/src/index.ts`
  - `tests/integration/server-api.test.ts`
- Acceptance criteria:
  - Status polling reflects lifecycle changes.
  - Markdown endpoint returns generated deck.

### T014 - CLI Orchestration Wiring

- Status: `done`
- Owner: `subagent-cli`
- Depends on: T003, T005, T006, T007, T008, T009, T010, T012, T013
- Scope:
  - Wire full workflow from command execution to server startup.
  - Print URL immediately and keep process alive for local viewing.
- Deliverables:
  - `packages/cli/src/orchestrator.ts`
  - `tests/integration/cli-e2e.mocked.test.ts`
- Acceptance criteria:
  - Early page load shows pending status until ready.
  - Failure exits non-zero and points to logs.

### T015 - Web Deck Renderer

- Status: `done`
- Owner: `subagent-web`
- Depends on: T001, T013
- Scope:
  - Build Vite app that polls job status and renders markdown slides.
  - Implement code block rendering with highlighted lines.
- Deliverables:
  - `apps/web/src/*`
  - `tests/e2e/web-render.test.ts`
- Acceptance criteria:
  - Spinner appears for non-ready jobs.
  - Deck navigation works via keyboard and UI controls.

### T016 - Export Actions (MD and PDF)

- Status: `done`
- Owner: `subagent-web`
- Depends on: T015
- Scope:
  - Add "Save Markdown" action.
  - Add "Save PDF" action with print stylesheet.
- Deliverables:
  - `apps/web/src/export.ts`
  - `apps/web/src/print.css`
  - `tests/e2e/export.test.ts`
- Acceptance criteria:
  - Markdown download matches generated file.
  - PDF export path works from UI.

### T017 - Reproducibility Test Suite

- Status: `done`
- Owner: `subagent-quality`
- Depends on: T007, T008, T009, T010, T012
- Scope:
  - Add fixture-driven reproducibility tests validating identical normalized output for identical inputs/settings.
- Deliverables:
  - `tests/integration/reproducibility.test.ts`
  - `tests/fixtures/*`
- Acceptance criteria:
  - Test fails on output drift.
  - Test logs differences for debugging.

### T018 - End-to-End Happy Path

- Status: `done`
- Owner: `subagent-quality`
- Depends on: T014, T015, T016
- Scope:
  - Build full mocked E2E from CLI invocation to rendered deck.
- Deliverables:
  - `tests/e2e/full-flow.test.ts`
- Acceptance criteria:
  - Covers spinner -> ready transition.
  - Verifies at least one snippet link and highlight render.

### T019 - Failure-Path and Recovery Tests

- Status: `done`
- Owner: `subagent-quality`
- Depends on: T014
- Scope:
  - Validate failure behavior for clone errors, model errors, schema validation errors.
- Deliverables:
  - `tests/integration/failure-paths.test.ts`
- Acceptance criteria:
  - Non-zero exit codes on terminal failures.
  - Artifacts/logs remain available post-failure.

### T020 - Docs and Self-Tour

- Status: `done`
- Owner: `subagent-docs`
- Depends on: T014, T016, T018
- Scope:
  - Write run/build/test docs.
  - Add an example generated tour artifact for a small fixture repo.
  - Document how to interpret tool outputs and logs.
- Deliverables:
  - `README.md`
  - `docs/architecture.md`
  - `docs/testing.md`
  - `docs/troubleshooting.md`
- Acceptance criteria:
  - A new contributor can run the tool and test suite with docs alone.
  - Docs explain `TOUR_HOME` and output layout.

## Dependency Summary

- Critical path:
  - T001 -> T002 -> T003 -> T005 -> T007 -> T008 -> T009 -> T010 -> T012 -> T013 -> T014 -> T015 -> T016 -> T018 -> T020
- Parallelizable streams:
  - T006 can run after T002/T003.
  - T011 can run after T005/T010.
  - T017 can start once generation + normalization are stable.
  - T019 can start once orchestration exists.

## Suggested Parallel Execution Batches

Batch 1:
- T001

Batch 2:
- T002, T003, T004

Batch 3:
- T005, T006

Batch 4:
- T007, T008, T009, T010, T011, T012

Batch 5:
- T013, T014, T015

Batch 6:
- T016, T017, T018, T019

Batch 7:
- T020

## Subagent Handoff Template

Use this template when a subagent picks a task:

```text
Task: <ID>
Status: in_progress
Scope:
Files:
Plan:
Risks:
Definition of done checks:
```

Use this template when completing a task:

```text
Task: <ID>
Status: done
Changes:
Tests run:
Known limitations:
Follow-up tasks:
```
