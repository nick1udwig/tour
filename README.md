# Tour

CLI + local web app that generates a codebase onboarding slide deck for a public GitHub repository.

## Quick start

```bash
bun install
bun run typecheck
bun run test
bun run --cwd apps/web build
bun run packages/cli/src/index.ts https://github.com/nick1udwig/tour --open
```

## CLI

```bash
tour <github-url> [--branch <branch>] [--port <n>] [--open] [--out <path>] [--model <id>] [--reasoning-effort <minimal|low|medium|high|xhigh>] [--max-duration <minutes>]
```

Example:

```bash
tour https://github.com/nick1udwig/tour --branch main --port 4173 --model gpt-5.3-codex --reasoning-effort medium
```

## Environment

- `TOUR_HOME`: override default output root.
  - default: `~/.tour`
- `CODEX_API_KEY`: required for Codex SDK generation.
- `TOUR_MODEL`: default model id for generation.
  - default: `gpt-5.3-codex`
- `TOUR_REASONING_EFFORT`: default reasoning effort (`minimal|low|medium|high|xhigh`).
  - default: `medium`
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
