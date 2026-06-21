# Repository Guidelines

## Project Structure & Module Organization

This repository is a Next.js application for Vida Produtiva costing and pricing workflows. Main app routes and API endpoints live in `app/`, including authentication, business persistence, reports, and system status APIs. Shared business logic, storage helpers, PDF generation, permissions, and server database/auth utilities live in `lib/`. Static brand assets are in `public/brand/`. Netlify Database migrations are stored in `netlify/database/migrations/`. Unit tests live in `tests/` and mirror the relevant domain module, for example `pricing.test.ts` for `lib/pricing.ts`.

Ignore generated folders such as `.next/`, `node_modules/`, and deployment archives under `outputs/`.

## Build, Test, and Development Commands

Use Node.js 20 or newer.

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

`npm run dev` starts the local Next.js server. `npm test` runs Vitest. `npm run typecheck` validates TypeScript without emitting files. `npm run build` creates the production build used by Netlify.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep domain calculations in `lib/` and UI behavior in `app/page.tsx` unless a route-specific API belongs under `app/api/`. Prefer clear camelCase names for variables and functions, PascalCase for React components and exported types, and kebab-case or numbered SQL migration names, such as `002_add-user-roles.sql`. Keep comments short and only where they clarify non-obvious business rules.

## Testing Guidelines

Tests use Vitest and should be placed in `tests/` with the `*.test.ts` suffix. Add focused tests for pricing formulas, storage normalization, PDF output, permissions, and any new shared helper. Run `npm test` and `npm run typecheck` before handing off changes. For changes touching Netlify routes or database behavior, also run `npm run build`.

## Commit & Pull Request Guidelines

No strict commit convention is enforced in this repository. Use short, imperative commit messages such as `Add admin user management` or `Fix Netlify database detection`. Pull requests should summarize user-visible changes, mention any database migration, list verification commands run, and include screenshots for UI changes.

## Security & Configuration Tips

Never commit `.env.local`, real OpenAI keys, or admin passwords. Netlify production needs `VP_ADMIN_EMAIL`, `VP_ADMIN_PASSWORD`, and optionally `OPENAI_API_KEY` plus `OPENAI_REPORT_MODEL`. Do not set `VP_LOCAL_MODE` in Netlify; it is only for local no-database runs.
