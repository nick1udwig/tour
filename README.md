# Tour

CLI + local web app that generates a codebase onboarding slide deck for a public GitHub repository.

## Quick start

```bash
bun install
bun run typecheck
bun run test
bun run --cwd apps/web build
bun run packages/cli/src/index.ts https://github.com/openai/codex --open
```

## CLI

```bash
tour <github-url> [--branch <branch>] [--port <n>] [--open] [--out <path>] [--model <id>] [--max-duration <minutes>]
```

Example:

```bash
tour https://github.com/openai/codex --branch main --port 4173 --model gpt-5-codex
```

## Environment

- `TOUR_HOME`: override default output root.
  - default: `~/.tour`
- `CODEX_API_KEY`: required for Codex SDK generation.
- `TOUR_NO_KEEPALIVE=1`: do not keep local server alive after run (useful for CI/tests).

## Output layout

Each run writes:

```text
<tour-root>/<owner>/<repo>/<YYYYMMDD-HHmmssZ>/
├── repo/
├── slides/
│   ├── tour.md
│   └── tour.normalized.md
├── meta/
│   ├── context.json
│   ├── job.json
│   ├── model.json
│   └── prompt.txt
└── logs/
    └── generation.log
```

## Docs

- `docs/architecture.md`
- `docs/testing.md`
- `docs/troubleshooting.md`
- `docs/examples/sample-tour.md`
