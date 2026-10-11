# VX3 Simulator: agent guide

A PS1-style browser bench toy simulating a historical "full" VX3 rig from r/VXJunkies, built as a scrolling 19-inch equipment rack. Stack: Vite, TypeScript, Three.js, Vitest, ESLint, Prettier; hosted on Fly.io.

## Roles

- **Creative lead** (design, writing, gameplay code): start from the newest prompt in `doc/resume/`.
- **Devops** (dependencies, build tooling, CI, Docker, Fly.io): owns `package.json` dependencies, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `Dockerfile`, `fly.toml`, `deploy/` and `.github/workflows/`. Other agents request changes in `doc/requests/`.

## Rules

- Stay on `main`. Do not create branches or worktrees.
- Before committing, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`.
- Markdown is one paragraph per line, never hard-wrapped.
- Record significant sessions in `diary/` (template in `diary/README.md`).
- Never commit `agent-mailbox.toml` or `agent-inbox.toml`.
