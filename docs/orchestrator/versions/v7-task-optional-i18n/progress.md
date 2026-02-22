# Progress — v7-task-optional-i18n

## 2026-02-22
- Worker-1 completed landing/task-optionality slice:
  - Landing page (`app/page.tsx`) now keeps a clean Google-only sign-in flow by removing landing success-message handling tied to email magic-link prompts.
  - Task creation form now treats due date, project, and label as optional UI inputs with safe defaults (`components/add-tasks/add-task-inline.tsx`):
    - due date can be empty and falls back to current timestamp,
    - project/label selectors support “Use default ...”.
  - Quick add no longer blocks task creation while waiting for project/label hydration (`components/shared/quick-task-input.tsx`).
  - Supabase task creation API now resolves safe defaults server-side when due date/project/label are omitted (`lib/supabase/api.ts` for todo + sub-todo create paths).
- Validation run:
  - `npm run lint` ✅
  - `npm run build` ✅

- Worker-2 completed i18n foundation + settings locale persistence slice:
  - Added centralized locale dictionary/config (`lib/i18n.ts`) with ko/en copy for:
    - settings language/module labels,
    - add-task inline UI text and validation/toast copy,
    - Eisenhower titles/quadrants/loading/empty/completion copy,
    - Kanban titles/columns/loading/empty copy.
  - Wired key UI text to locale-aware messages:
    - `components/add-tasks/add-task-inline.tsx`
    - `components/containers/eisenhower.tsx`
    - `components/containers/kanban.tsx`
    - `components/containers/settings-modules.tsx`
    - `components/kanban/kanban-column.tsx` (empty-state text passthrough)
  - Settings locale persistence path is now end-to-end:
    - locale selector saves through `api.userFeatureSettings.upsertMySettings`,
    - app components consume `settings.locale` via `getLocaleMessages(...)`.
- Validation run (post-i18n):
  - `npm run lint` ✅
  - `npm run build` ✅
