# V7 Task Projection Schema Expansion — QA Checklist

Use this checklist for release validation of:
- `task_projections`
- `task_projection_positions`
- `task_relationships`
- `custom_field_definitions`
- `custom_field_values`

Terminology matches V7 migration + API docs (`todo` / `sub_todo`, `relation_kind`, `projection_kind`, `applies_to`).

---

## 1) Environment + setup

- [ ] QA environment has migration `20260222_v7_task_projection_schema_expansion.sql` applied.
- [ ] Two test users exist (`user_a`, `user_b`) for RLS isolation checks.
- [ ] Seed data includes:
  - [ ] at least 3 `todo` tasks
  - [ ] at least 2 `sub_todo` tasks
- [ ] Feature flags are configurable for test cohorts.

---

## 2) Projection flow checks

### 2.1 Projection CRUD
- [ ] Create projection with `projection_kind=custom`.
- [ ] Create projection with non-default kinds (ex: `kanban`, `timeline`).
- [ ] Update projection name/description.
- [ ] Set one projection as default; verify only one default per user.
- [ ] Archive projection and verify it is hidden from non-archived list.
- [ ] Delete projection and verify cascade deletes projection positions.

### 2.2 Projection positions (task placement)
- [ ] Upsert position for a `todo` (`lane_key`, `lane_position`, `sort_rank`).
- [ ] Upsert position for a `sub_todo`.
- [ ] Move task between lanes and verify ordering updates correctly.
- [ ] Bulk upsert multiple positions and verify deterministic sort.
- [ ] Delete a projection position by task ref.

### 2.3 Negative cases
- [ ] Invalid task ref combination is rejected (`task_kind=todo` with `sub_todo_id`, etc.).
- [ ] Blank `lane_key` is normalized/rejected per API rules.
- [ ] Duplicate position for same projection/task is prevented by uniqueness constraints.

---

## 3) Task relationship flow checks

### 3.1 Create/read/delete
- [ ] Create `depends_on` relationship (`todo` -> `todo`).
- [ ] Create one non-default relationship kind (`blocks` or `related_to`).
- [ ] Create cross-kind relationship (`todo` -> `sub_todo` or inverse).
- [ ] Read relationships for source and target tasks.
- [ ] Delete relationship by ID.
- [ ] Delete relationship by edge (`relation_kind + source + target`).

### 3.2 Constraint + dedupe behavior
- [ ] Self-edge create attempt is blocked.
- [ ] Duplicate edge create returns existing relationship (no duplicate row).
- [ ] Invalid source/target task ownership is blocked by RLS/policies.

---

## 4) Custom field flow checks

### 4.1 Definition lifecycle
- [ ] Create definition with valid `field_key` and `display_name`.
- [ ] Verify `field_key` normalization (lowercase/snake_case).
- [ ] Create definitions for each field type:
  - [ ] `text`
  - [ ] `number`
  - [ ] `boolean`
  - [ ] `date`
  - [ ] `single_select`
  - [ ] `multi_select`
  - [ ] `json`
- [ ] Update definition metadata (`description`, `validation`, `sort_order`).
- [ ] Archive and unarchive definition.
- [ ] Delete definition and verify dependent values are cleaned up.

### 4.2 Value lifecycle
- [ ] Upsert value on `todo` for matching `applies_to`.
- [ ] Upsert value on `sub_todo` for matching `applies_to`.
- [ ] Verify `applies_to` mismatch throws expected error.
- [ ] Update existing value and verify only one value column is populated.
- [ ] Clear value (`null`/empty) and verify row deletion behavior.

### 4.3 Validation negative cases
- [ ] Non-finite number value is rejected.
- [ ] Invalid boolean payload is rejected.
- [ ] Invalid date payload is rejected.

---

## 5) Regression checks (existing behavior)

- [ ] Existing todo CRUD works unchanged.
- [ ] Existing sub_todo CRUD works unchanged.
- [ ] Existing workflow status and Eisenhower flows still work.
- [ ] Completion timestamp sync works:
  - [ ] setting `is_completed=true` sets `completed_at`
  - [ ] unsetting completion clears `completed_at`
- [ ] No auth/RLS regression: `user_b` cannot read/write `user_a` V7 data.
- [ ] Projection pages still function when read flag is OFF (legacy projection fallback).

---

## 6) Rollback readiness checks

- [ ] Turn OFF `v7_projection_ui_enabled` and verify UI hides V7 controls.
- [ ] Turn OFF `v7_projection_read_enabled` and verify projection view still loads (fallback).
- [ ] Turn OFF `v7_projection_dual_write_enabled` and verify no new V7 writes are generated.
- [ ] Execute rollback drill end-to-end in <=10 minutes.

---

## 7) Sign-off

- QA Owner:
- Date:
- Environment:
- Result: **PASS / FAIL**
- Notes / Defects:

