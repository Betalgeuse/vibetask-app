-- V7 projection/schema expansion for advanced views, dependencies, custom fields, and scheduling.
-- Design intent: add extensible task management primitives without breaking existing todo/sub_todo tables.

-- 1) User-defined projection (view) definitions.
create table if not exists public.task_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  projection_kind text not null default 'custom'
    check (projection_kind in ('custom', 'list', 'kanban', 'timeline', 'calendar', 'table', 'matrix')),
  filters jsonb not null default '{}'::jsonb,
  sort_rules jsonb not null default '[]'::jsonb,
  lane_config jsonb not null default '{}'::jsonb,
  display_config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_projections_name_not_blank_chk
    check (char_length(btrim(name)) > 0)
);

create index if not exists idx_task_projections_user_id
  on public.task_projections(user_id);

create unique index if not exists idx_task_projections_user_name_unique
  on public.task_projections(user_id, lower(name));

create unique index if not exists idx_task_projections_single_default_per_user
  on public.task_projections(user_id)
  where (is_default and not is_archived);

-- 2) Projection-specific task lane/sort placement.
create table if not exists public.task_projection_positions (
  id uuid primary key default gen_random_uuid(),
  projection_id uuid not null references public.task_projections(id) on delete cascade,
  task_kind text not null check (task_kind in ('todo', 'sub_todo')),
  todo_id uuid references public.todos(id) on delete cascade,
  sub_todo_id uuid references public.sub_todos(id) on delete cascade,
  lane_key text not null default 'default',
  lane_position integer not null default 0,
  sort_rank numeric(20, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_projection_positions_lane_not_blank_chk
    check (char_length(btrim(lane_key)) > 0),
  constraint task_projection_positions_task_ref_chk
    check (
      (task_kind = 'todo' and todo_id is not null and sub_todo_id is null)
      or
      (task_kind = 'sub_todo' and sub_todo_id is not null and todo_id is null)
    )
);

create unique index if not exists idx_task_projection_positions_projection_todo_unique
  on public.task_projection_positions(projection_id, todo_id)
  where (task_kind = 'todo' and todo_id is not null);

create unique index if not exists idx_task_projection_positions_projection_sub_todo_unique
  on public.task_projection_positions(projection_id, sub_todo_id)
  where (task_kind = 'sub_todo' and sub_todo_id is not null);

create index if not exists idx_task_projection_positions_lane_sort
  on public.task_projection_positions(projection_id, lane_key, lane_position, sort_rank);

create index if not exists idx_task_projection_positions_todo_id
  on public.task_projection_positions(todo_id)
  where todo_id is not null;

create index if not exists idx_task_projection_positions_sub_todo_id
  on public.task_projection_positions(sub_todo_id)
  where sub_todo_id is not null;

-- 3) Directed task dependency/relationship edges.
create table if not exists public.task_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relation_kind text not null
    check (relation_kind in ('blocks', 'related_to', 'duplicates', 'parent_child', 'depends_on')),
  source_kind text not null check (source_kind in ('todo', 'sub_todo')),
  source_todo_id uuid references public.todos(id) on delete cascade,
  source_sub_todo_id uuid references public.sub_todos(id) on delete cascade,
  target_kind text not null check (target_kind in ('todo', 'sub_todo')),
  target_todo_id uuid references public.todos(id) on delete cascade,
  target_sub_todo_id uuid references public.sub_todos(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_relationships_source_ref_chk
    check (
      (source_kind = 'todo' and source_todo_id is not null and source_sub_todo_id is null)
      or
      (source_kind = 'sub_todo' and source_sub_todo_id is not null and source_todo_id is null)
    ),
  constraint task_relationships_target_ref_chk
    check (
      (target_kind = 'todo' and target_todo_id is not null and target_sub_todo_id is null)
      or
      (target_kind = 'sub_todo' and target_sub_todo_id is not null and target_todo_id is null)
    ),
  constraint task_relationships_no_self_edge_chk
    check (
      not (
        source_kind = target_kind
        and coalesce(source_todo_id, source_sub_todo_id) = coalesce(target_todo_id, target_sub_todo_id)
      )
    )
);

create unique index if not exists idx_task_relationships_unique_edge
  on public.task_relationships (
    user_id,
    relation_kind,
    source_kind,
    coalesce(source_todo_id, source_sub_todo_id),
    target_kind,
    coalesce(target_todo_id, target_sub_todo_id)
  );

create index if not exists idx_task_relationships_source_lookup
  on public.task_relationships (
    user_id,
    source_kind,
    coalesce(source_todo_id, source_sub_todo_id)
  );

create index if not exists idx_task_relationships_target_lookup
  on public.task_relationships (
    user_id,
    target_kind,
    coalesce(target_todo_id, target_sub_todo_id)
  );

-- 4) Custom field definitions and per-task values.
create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_key text not null,
  display_name text not null,
  description text,
  field_type text not null
    check (field_type in ('text', 'number', 'boolean', 'date', 'single_select', 'multi_select', 'json')),
  applies_to text not null default 'both' check (applies_to in ('todo', 'sub_todo', 'both')),
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  is_required boolean not null default false,
  is_archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_field_definitions_key_not_blank_chk
    check (char_length(btrim(field_key)) > 0),
  constraint custom_field_definitions_name_not_blank_chk
    check (char_length(btrim(display_name)) > 0),
  constraint custom_field_definitions_key_format_chk
    check (field_key ~ '^[a-z][a-z0-9_]*$')
);

create unique index if not exists idx_custom_field_definitions_user_key_unique
  on public.custom_field_definitions(user_id, lower(field_key));

create unique index if not exists idx_custom_field_definitions_user_name_unique
  on public.custom_field_definitions(user_id, lower(display_name));

create index if not exists idx_custom_field_definitions_user_scope
  on public.custom_field_definitions(user_id, applies_to, is_archived);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  task_kind text not null check (task_kind in ('todo', 'sub_todo')),
  todo_id uuid references public.todos(id) on delete cascade,
  sub_todo_id uuid references public.sub_todos(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date bigint,
  value_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_field_values_task_ref_chk
    check (
      (task_kind = 'todo' and todo_id is not null and sub_todo_id is null)
      or
      (task_kind = 'sub_todo' and sub_todo_id is not null and todo_id is null)
    ),
  constraint custom_field_values_single_value_chk
    check (num_nonnulls(value_text, value_number, value_boolean, value_date, value_json) <= 1)
);

create unique index if not exists idx_custom_field_values_field_todo_unique
  on public.custom_field_values(field_id, todo_id)
  where (task_kind = 'todo' and todo_id is not null);

create unique index if not exists idx_custom_field_values_field_sub_todo_unique
  on public.custom_field_values(field_id, sub_todo_id)
  where (task_kind = 'sub_todo' and sub_todo_id is not null);

create index if not exists idx_custom_field_values_user_field
  on public.custom_field_values(user_id, field_id);

create index if not exists idx_custom_field_values_task_lookup
  on public.custom_field_values(user_id, task_kind, coalesce(todo_id, sub_todo_id));

create index if not exists idx_custom_field_values_date_lookup
  on public.custom_field_values(value_date)
  where value_date is not null;

-- 5) Timeline/scheduling reinforcement for existing todos + sub_todos.
alter table public.todos
  add column if not exists start_date bigint,
  add column if not exists completed_at timestamptz;

alter table public.sub_todos
  add column if not exists start_date bigint,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'todos_start_date_before_due_date_chk'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_start_date_before_due_date_chk
      check (start_date is null or start_date <= due_date);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sub_todos_start_date_before_due_date_chk'
      and conrelid = 'public.sub_todos'::regclass
  ) then
    alter table public.sub_todos
      add constraint sub_todos_start_date_before_due_date_chk
      check (start_date is null or start_date <= due_date);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'todos_completed_at_requires_completed_chk'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_completed_at_requires_completed_chk
      check (completed_at is null or is_completed = true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sub_todos_completed_at_requires_completed_chk'
      and conrelid = 'public.sub_todos'::regclass
  ) then
    alter table public.sub_todos
      add constraint sub_todos_completed_at_requires_completed_chk
      check (completed_at is null or is_completed = true);
  end if;
end
$$;

create index if not exists idx_todos_start_date
  on public.todos(start_date)
  where start_date is not null;

create index if not exists idx_sub_todos_start_date
  on public.sub_todos(start_date)
  where start_date is not null;

create index if not exists idx_todos_completed_at
  on public.todos(completed_at)
  where completed_at is not null;

create index if not exists idx_sub_todos_completed_at
  on public.sub_todos(completed_at)
  where completed_at is not null;

-- Keep completion timestamps coherent with existing is_completed/status sync flow.
create or replace function public.sync_task_completion_timestamps_v7()
returns trigger
language plpgsql
as $$
begin
  if new.is_completed then
    if new.completed_at is null then
      if tg_op = 'UPDATE' then
        new.completed_at := coalesce(old.completed_at, now());
      else
        new.completed_at := now();
      end if;
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_todos_sync_v7_completion_timestamps on public.todos;
create trigger trg_todos_sync_v7_completion_timestamps
before insert or update on public.todos
for each row
execute function public.sync_task_completion_timestamps_v7();

drop trigger if exists trg_sub_todos_sync_v7_completion_timestamps on public.sub_todos;
create trigger trg_sub_todos_sync_v7_completion_timestamps
before insert or update on public.sub_todos
for each row
execute function public.sync_task_completion_timestamps_v7();

-- 6/7) RLS + CRUD policies on every new table.
alter table public.task_projections enable row level security;
alter table public.task_projection_positions enable row level security;
alter table public.task_relationships enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;

-- task_projections policies
drop policy if exists "task_projections_select" on public.task_projections;
create policy "task_projections_select"
on public.task_projections
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "task_projections_insert" on public.task_projections;
create policy "task_projections_insert"
on public.task_projections
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "task_projections_update" on public.task_projections;
create policy "task_projections_update"
on public.task_projections
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "task_projections_delete" on public.task_projections;
create policy "task_projections_delete"
on public.task_projections
for delete
to authenticated
using (user_id = auth.uid());

-- task_projection_positions policies
drop policy if exists "task_projection_positions_select" on public.task_projection_positions;
create policy "task_projection_positions_select"
on public.task_projection_positions
for select
to authenticated
using (
  exists (
    select 1
    from public.task_projections p
    where p.id = projection_id
      and p.user_id = auth.uid()
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "task_projection_positions_insert" on public.task_projection_positions;
create policy "task_projection_positions_insert"
on public.task_projection_positions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.task_projections p
    where p.id = projection_id
      and p.user_id = auth.uid()
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "task_projection_positions_update" on public.task_projection_positions;
create policy "task_projection_positions_update"
on public.task_projection_positions
for update
to authenticated
using (
  exists (
    select 1
    from public.task_projections p
    where p.id = projection_id
      and p.user_id = auth.uid()
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
)
with check (
  exists (
    select 1
    from public.task_projections p
    where p.id = projection_id
      and p.user_id = auth.uid()
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "task_projection_positions_delete" on public.task_projection_positions;
create policy "task_projection_positions_delete"
on public.task_projection_positions
for delete
to authenticated
using (
  exists (
    select 1
    from public.task_projections p
    where p.id = projection_id
      and p.user_id = auth.uid()
  )
);

-- task_relationships policies
drop policy if exists "task_relationships_select" on public.task_relationships;
create policy "task_relationships_select"
on public.task_relationships
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "task_relationships_insert" on public.task_relationships;
create policy "task_relationships_insert"
on public.task_relationships
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (source_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = source_todo_id
        and t.user_id = auth.uid()
    ))
    or
    (source_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = source_sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
  and (
    (target_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = target_todo_id
        and t.user_id = auth.uid()
    ))
    or
    (target_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = target_sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "task_relationships_update" on public.task_relationships;
create policy "task_relationships_update"
on public.task_relationships
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    (source_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = source_todo_id
        and t.user_id = auth.uid()
    ))
    or
    (source_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = source_sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
  and (
    (target_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = target_todo_id
        and t.user_id = auth.uid()
    ))
    or
    (target_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = target_sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "task_relationships_delete" on public.task_relationships;
create policy "task_relationships_delete"
on public.task_relationships
for delete
to authenticated
using (user_id = auth.uid());

-- custom_field_definitions policies
drop policy if exists "custom_field_definitions_select" on public.custom_field_definitions;
create policy "custom_field_definitions_select"
on public.custom_field_definitions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "custom_field_definitions_insert" on public.custom_field_definitions;
create policy "custom_field_definitions_insert"
on public.custom_field_definitions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "custom_field_definitions_update" on public.custom_field_definitions;
create policy "custom_field_definitions_update"
on public.custom_field_definitions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "custom_field_definitions_delete" on public.custom_field_definitions;
create policy "custom_field_definitions_delete"
on public.custom_field_definitions
for delete
to authenticated
using (user_id = auth.uid());

-- custom_field_values policies
drop policy if exists "custom_field_values_select" on public.custom_field_values;
create policy "custom_field_values_select"
on public.custom_field_values
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.custom_field_definitions d
    where d.id = field_id
      and d.user_id = auth.uid()
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "custom_field_values_insert" on public.custom_field_values;
create policy "custom_field_values_insert"
on public.custom_field_values
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.custom_field_definitions d
    where d.id = field_id
      and d.user_id = auth.uid()
      and (d.applies_to = 'both' or d.applies_to = task_kind)
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "custom_field_values_update" on public.custom_field_values;
create policy "custom_field_values_update"
on public.custom_field_values
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.custom_field_definitions d
    where d.id = field_id
      and d.user_id = auth.uid()
      and (d.applies_to = 'both' or d.applies_to = task_kind)
  )
  and (
    (task_kind = 'todo' and exists (
      select 1
      from public.todos t
      where t.id = todo_id
        and t.user_id = auth.uid()
    ))
    or
    (task_kind = 'sub_todo' and exists (
      select 1
      from public.sub_todos st
      where st.id = sub_todo_id
        and st.user_id = auth.uid()
    ))
  )
);

drop policy if exists "custom_field_values_delete" on public.custom_field_values;
create policy "custom_field_values_delete"
on public.custom_field_values
for delete
to authenticated
using (user_id = auth.uid());
