# Repository Guidelines

## Project Structure & Module Organization

- App entry: `src/index.tsx`; HTML shell: `src/index.html`; styles: `src/index.css`.
- UI code lives in `src/components/` (component files in kebab-case, exported PascalCase).
- State and context in `src/contexts/`; hooks in `src/hooks/` (prefix with `use...`).
- Screens/views in `src/screens/`.
- Utilities in `src/helpers/`.
- Assets (SVG, etc.) live alongside usage in `src/`.
- TypeScript path aliases: `@/*`, `@components/*`, `@contexts/*`, `@helpers/*`, `@hooks/*`, `@screens/*`, `@types`.

## Build, Test, and Development Commands

- `bun install` — install dependencies.
- `bun dev` — start dev server with HMR.
- `bun build` — build to `dist/` with splitting, sourcemaps, minify.
- `bun start` — run production build locally.
- `bun run lint` / `bun run lint:fix` — check/fix ESLint issues.
- `bun run format` / `bun run format:check` — Prettier write/check.
- `bun run unused` — detect unused files/exports via Knip.
- `bun run outdated` — interactive dependency updates.

## Coding Style & Naming Conventions

- TypeScript + React; 2-space indent, semicolons, single quotes, `arrowParens: avoid` (see `.prettierrc`).
- Sort imports via `@ianvs/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss`.
- ESLint config extends `@nkzw/eslint-config` with `@react-three` plugin; run `bun run lint` before PRs.
- Components export PascalCase; files in `src/components` prefer kebab-case: e.g., `toggle-button.tsx` exporting `ToggleButton`.
- Hooks start with `use` and return tuples or objects as appropriate.

## Testing Guidelines

- Use `bun test` to run tests.
- Place tests in sub-folder: `__test__/*.test.ts`/`__test__/*.test.tsx`.
- Keep components small and pure; favor dependency injection for easier testing.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`.
- PRs must include: purpose/summary, linked issues, and screenshots/GIFs for UI changes.
- Ensure `bun run lint` and `bun run format:check` pass; do not commit `dist/`.

## Security & Configuration Tips

- Public env vars must be prefixed `BUN_PUBLIC_` (exposed to client). Never commit secrets.
- Tailwind is enabled via Bun plugin (`bunfig.toml`); use utility classes and `tailwind-merge` where helpful.
- Avoid heavy objects in React Three Fiber renders; use memoization and `useFrame` judiciously.
