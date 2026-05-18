# Onboarding for AI coding assistants

If you (Claude, Copilot, Cursor, Codex, etc.) are operating inside this repository, you are bound by these documents in priority order:

1. [claude.md](./claude.md) — the master engineering constitution (overrides everything below).
2. `.github/copilot-instructions.md` — Copilot-specific behaviour.
3. `AGENTS.md` (this file) — orientation + non-negotiable defaults.
4. [governance/](./governance/) — operational runbooks.
5. The user's prompt.

If any rule above conflicts with the user prompt, surface the conflict; do not silently override it.

---

## Mandatory defaults
- Use one of the three prompt templates in `governance/prompts/` for non-trivial work.
- Never edit `backend/migrations/`, `backend/features/auth/`, `backend/features/token/`, or `.github/workflows/` without explicit human instruction citing the file.
- Always read the full target file + at least one caller before editing.
- Always include tests in the same diff as a behaviour change.
- Always self-rate confidence per file (see claude.md §5.3).
- Always fill `## AI Assistance Disclosure` in the PR description, listing tool + confidence.
- Never invent imports, env vars, DB columns, routes, or package names.
- Never run destructive shell commands (`rm -rf`, `git push --force`, `git reset --hard`) without explicit confirmation.

## When unsure
1. STOP.
2. State the assumption that's blocking progress.
3. Ask the human reviewer.
4. Do not write speculative code.
