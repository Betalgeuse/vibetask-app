# V7 Task Projection Schema Expansion — Rollout Runbook

## 1) Scope and terminology

**Migration in scope**
- `supabase/migrations/20260222_v7_task_projection_schema_expansion.sql`

**API surface in scope**
- `api.projections.*`
- `api.relationships.*`
- `api.customFields.*`

**V7 terms (use consistently in ops + QA)**
- **task projection**: row in `task_projections`
- **projection position**: row in `task_projection_positions`
- **task relationship**: row in `task_relationships`
- **custom field definition**: row in `custom_field_definitions`
- **custom field value**: row in `custom_field_values`
- **task kind**: `todo` or `sub_todo`
- **legacy projection fallback**: built-in projections returned when V7 tables are unavailable

---

## 2) Pre-deploy prerequisites

- Confirm Supabase connectivity and migration tooling are healthy.
- Confirm no long-running schema migration is active.
- Confirm on-call + rollback owner are assigned.
- Confirm baseline migrations are already applied in order up to V5, then V7:
  1. `20260221_supabase_auth_data.sql`
  2. `20260221_v3_eisenhower_priority_status.sql`
  3. `20260221_v4_1_persona_custom_only.sql`
  4. `20260221_v4_task_payload_foundation.sql`
  5. `20260222_v5_label_color.sql`
  6. `20260222_v7_task_projection_schema_expansion.sql`

---

## 3) Migration and rollout order

1. **Deploy app build with V7 flags OFF** (read OFF, dual-write OFF).
2. **Apply V7 migration** (`20260222_v7_task_projection_schema_expansion.sql`).
3. **Run schema smoke checks** (tables, indexes, RLS, triggers; see section 5).
4. **Enable dual-write for internal cohort only**.
5. **Run dual-write/dual-read checks** (section 4) for projections, relationships, custom fields.
6. **Enable V7 read path for internal cohort**.
7. **Ramp traffic** (10% → 25% → 50% → 100%) only if checks stay green.

> Keep each ramp stage at least one error-budget window (recommended 10–15 min) before the next stage.

---

## 4) Feature-flag strategy + dual-write/read checks

### Logical flags
Map these logical toggles to your flag provider keys:

- `v7_projection_read_enabled`
  - `false`: keep legacy projection fallback read behavior.
  - `true`: read from V7 tables (`task_projections` + related tables).
- `v7_projection_dual_write_enabled`
  - `false`: no V7 write attempts from rollout traffic.
  - `true`: write V7 tables while keeping legacy-compatible behavior.
- `v7_projection_ui_enabled`
  - controls end-user exposure of projection/custom-field/relationship UI.

### Recommended phase gates
- **Phase A**: all flags OFF.
- **Phase B**: dual-write ON (internal users only), read OFF.
- **Phase C**: dual-write ON + read ON (internal users).
- **Phase D**: UI ON for staged cohorts.

### Dual-write checks (must pass before enabling read)
- Create/update/delete at least one:
  - task projection
  - projection position (for both `todo` and `sub_todo`)
  - task relationship (`depends_on` + one non-default kind)
  - custom field definition + value
- Confirm rows exist and `updated_at` changes in each target table.
- Confirm constraint behavior:
  - no duplicate default projection per user
  - no self-edge relationship
  - custom field applies-to restrictions enforced

### Dual-read checks (must pass before >25% ramp)
- For sampled users, compare API payload shape and non-empty states between:
  - read flag OFF (legacy fallback path)
  - read flag ON (V7 path)
- Verify no unexpected 4xx/5xx increase and no `V7 feature unavailable` fallback spikes.

---

## 5) Post-migration SQL smoke checks

Run after migration and after each major ramp stage:

```sql
-- 1) New tables exist
select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'task_projections',
    'task_projection_positions',
    'task_relationships',
    'custom_field_definitions',
    'custom_field_values'
  )
order by tablename;

-- 2) RLS enabled on all new tables
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in (
  'task_projections',
  'task_projection_positions',
  'task_relationships',
  'custom_field_definitions',
  'custom_field_values'
)
order by relname;

-- 3) Trigger exists for completion timestamp sync
select tgname, tgrelid::regclass as table_name
from pg_trigger
where tgname in (
  'trg_todos_sync_v7_completion_timestamps',
  'trg_sub_todos_sync_v7_completion_timestamps'
);
```

---

## 6) Rollback procedure (target: <= 10 minutes)

**Rollback principle:** V7 schema changes are additive. Prefer **flag rollback** (fast) instead of DDL rollback.

### Minute-by-minute rollback playbook
- **T+0 to T+2 min**
  - Set `v7_projection_ui_enabled = false`
  - Set `v7_projection_read_enabled = false`
- **T+2 to T+4 min**
  - Set `v7_projection_dual_write_enabled = false`
  - Stop rollout ramps / freeze cohort expansion
- **T+4 to T+7 min**
  - Verify traffic is on legacy fallback reads (projection pages still load)
  - Confirm error rate returns to baseline
- **T+7 to T+10 min**
  - Execute quick smoke test: list tasks, open projection view, update one task
  - Post incident update with decision: hold / hotfix / retry window

### If emergency data protection is needed
- Keep flags OFF.
- Export impacted V7 rows for forensic analysis.
- Avoid dropping new tables during incident; perform cleanup in a planned follow-up migration.

---

## 7) Post-deploy verification checklist

- [ ] Migration applied successfully in target environment.
- [ ] RLS enabled and policy checks pass for all 5 V7 tables.
- [ ] Projection CRUD works for both `todo` and `sub_todo` positions.
- [ ] Relationship create/delete works; self-edge blocked.
- [ ] Custom field definition/value flows pass all supported field types.
- [ ] No regression in existing todo/sub_todo flows.
- [ ] Error budget stable across 1h after 100% rollout.
- [ ] Rollback test (flag-only) exercised successfully in non-prod.

