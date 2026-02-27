# Troubleshooting

## `Codex generation failed: authentication error`

Set `CODEX_API_KEY` in your shell before running CLI.

## `Branch "..." was not found`

Branch does not exist on remote.
- Re-run without `--branch` to use default branch.
- Or pass a valid remote branch name.

## Page stays loading

Check:
- CLI process still running.
- `logs/generation.log` for failure reason.
- `/api/jobs/:jobId/status` returns `ready` or `failed`.

## Missing static assets

Build web app before CLI run:

```bash
bun run --cwd apps/web build
```

## Output path confusion

Resolution order:
1. `--out`
2. `TOUR_HOME`
3. `~/.tour`
