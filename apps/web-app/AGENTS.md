@Docs https://heroui.com/react/llms-full.txt

# AGENTS Guide

This document describes practical rules for AI agents working in `apps/web-app`.

## Goals

- Make changes predictably and within the project architecture.
- Preserve layer separation: `di` (business logic) / `app` (infrastructure and pages) / `views` (UI).
- Do not blur responsibilities between pages, widgets, and DI services.

## Project map

- `./src/di` — services, API clients, container modules, types.
- `./src/app` — entry point, routing, layout, app-level orchestration.
- `./src/views`:
  - `ui` / `components` — primitives and pure UI;
  - `widgets` — complex UI logic, queries, DI integration;
  - `layouts` — page shells.

## Required architecture rules

1. **Pages (`app/routes/**/page.tsx`) must stay thin**  
   A page composes layout + widgets + simple navigation.  
   If logic grows on the page (query/mutation, derived state, form state, heavy handlers) — move it into a widget.

2. **Complex logic belongs in `views/widgets`**  
   Widgets may:
   - use `useDi`, `useSnapshot`, `react-query`;
   - hold local UI state;
   - assemble business data for display.

3. **`views/components` and `views/ui` — no business logic**  
   Do not pull DI services or scenario logic there.

4. **`di/**` must not depend on UI**  
   Providers, APIs, modules, and types must not import `views` components.

5. **i18n is required for user-facing copy**  
   Use `useT()` and keys in `di/i18n/i18n-js/en.json` for UI text.

## Routing (TanStack Router)

- In each segment:
  - `routes.tsx` — `createRoute`, export `indexRoute`, `tree`;
  - `page.tsx` — page component.
- Dynamic segments use `$param` (e.g. `$itemId`).
- New child routes must be wired into the parent tree via `addChildren`.
- Parent pages may conditionally render:
  - index content for the base route;
  - `<Outlet />` for nested full-screen routes.

## DI (Inversify + Valtio) — adding a module

When adding a new domain:

1. Create `types.ts` with:
   - a `Symbol.for(...)` token;
   - provider interface and data types.
2. Create `provider.ts` with `@injectable()`.
3. Create `module.ts` and bind in `inSingletonScope()`.
4. Register the module in `di/container.ts`.
5. If the service must start on boot, add `initialize()` in `di/app/app.provider.ts`.

### Scaffolding a DI module with the generator

You can speed this up with the Inversify generator: [undermuz/inversify-generator](https://github.com/undermuz/inversify-generator).

Command to add a new module to a specific app:

```bash
npx @undermuz/inversify-generator add-module <MODULE NAME> --project=apps/<APP NAME>/src
```

After generation:

- review and adjust `types.ts`, `provider.ts`, `module.ts` as needed;
- ensure the module is correctly registered in `di/container.ts`;
- add initialization in `di/app/app.provider.ts` if required.

## UI and code style

- Use building blocks from `@libs/views` and `@libs/views/ui/*`.
- Prefer existing layouts, widgets, and naming patterns.
- Name new files per current conventions:
  - `index.tsx` for widgets;
  - `provider.ts`, `module.ts`, `types.ts` for DI.

## Change discipline

- Make the smallest change that solves the task; avoid drive-by refactors.
- Do not break existing type contracts without a strong reason.
- After edits, run linter / typecheck on touched files.

## Quick agent checklist

- [ ] Page logic stays light; complex pieces live in widgets.
- [ ] UI copy uses `useT`; keys added to i18n.
- [ ] New DI module registered in the container.
- [ ] If needed, service initializes in the `App` provider.
- [ ] New route hooked into the parent `tree`.
- [ ] Local checks (lint/types) pass for changed files.
