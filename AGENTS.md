# Agents

## Skills

This repository contains a `skills/` folder with specialized skill definitions. When performing work that relates to any of these skills, you **must** read the corresponding `SKILL.md` file before proceeding and follow its instructions.

## UI Verification

When you change any rendered UI in `apps/web` or another browser-visible surface, the work is not complete until you verify the result visually.

1. Run `pnpm --filter web ui:verify -- --path <route>` for every route you changed. Repeat `--path` for multiple pages.
2. If Chromium has not been installed for Playwright yet, run `pnpm --filter web playwright:install` first.
3. Review the generated screenshots under `apps/web/.artifacts/ui-screenshots/` before giving control back.
4. If a dev server is already running and you do not want to start a new one, use `pnpm --filter web ui:screenshot -- --path <route>` instead.
5. In your handoff, state which routes you verified and where the screenshot artifacts were written.

Do not hand work back after UI changes without either verified screenshots or a clear blocker explaining why verification could not run.
