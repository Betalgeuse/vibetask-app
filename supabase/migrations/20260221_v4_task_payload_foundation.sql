-- V4 foundation for extensible task payload / persona / epic / feature toggles

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'task_flow_stage'
      and n.nspname = 'public'
  ) then
    create type public.task_flow_stage as enum (
      'BACKLOG',
      'NEXT_WEEK',
      'THIS_WEEK',
      'TODAY',
      'DONE',
      'CANCEL'
    );
  end if;
end
$$;

create table if not exists public.epics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  type text not null default 'user' check (type in ('system', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_personas_user_code
on public.personas(user_id, lower(code));

create table if not exists public.user_feature_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled_modules jsonb not null default '{
    "persona": false,
    "epic": false,
    "story": true,
    "workload": true,
    "workflowStatus": true,
    "calendarSync": false
  }'::jsonb,
  task_property_visibility jsonb not null default '{
    "persona": false,
    "epic": false,
    "name": true,
    "description": true,
    "story": false,
    "priority": true,
    "workload": false,
    "dueDate": true,
    "workflowStatus": true
  }'::jsonb,
  sidebar_modules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos
  add column if not exists story text,
  add column if not exists epic_id uuid references public.epics(id) on delete set null,
  add column if not exists persona_id uuid references public.personas(id) on delete set null,
  add column if not exists workload integer check (workload >= 1 and workload <= 100),
  add column if not exists workflow_status public.task_flow_stage,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.sub_todos
  add column if not exists story text,
  add column if not exists epic_id uuid references public.epics(id) on delete set null,
  add column if not exists persona_id uuid references public.personas(id) on delete set null,
  add column if not exists workload integer check (workload >= 1 and workload <= 100),
  add column if not exists workflow_status public.task_flow_stage,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.todos
set workflow_status = case
  when status = 'DONE' then 'DONE'::public.task_flow_stage
  else 'BACKLOG'::public.task_flow_stage
end
where workflow_status is null;

update public.sub_todos
set workflow_status = case
  when status = 'DONE' then 'DONE'::public.task_flow_stage
  else 'BACKLOG'::public.task_flow_stage
end
where workflow_status is null;

alter table public.todos
  alter column workflow_status set default 'BACKLOG'::public.task_flow_stage,
  alter column workflow_status set not null;

alter table public.sub_todos
  alter column workflow_status set default 'BACKLOG'::public.task_flow_stage,
  alter column workflow_status set not null;

create index if not exists idx_epics_user_id on public.epics(user_id);
create index if not exists idx_personas_user_id on public.personas(user_id);
create index if not exists idx_personas_type on public.personas(type);
create index if not exists idx_todos_workflow_status on public.todos(workflow_status);
create index if not exists idx_todos_epic_id on public.todos(epic_id);
create index if not exists idx_todos_persona_id on public.todos(persona_id);
create index if not exists idx_sub_todos_workflow_status on public.sub_todos(workflow_status);
create index if not exists idx_sub_todos_epic_id on public.sub_todos(epic_id);
create index if not exists idx_sub_todos_persona_id on public.sub_todos(persona_id);

alter table public.epics enable row level security;
alter table public.personas enable row level security;
alter table public.user_feature_settings enable row level security;

drop policy if exists "epics_select" on public.epics;
create policy "epics_select"
on public.epics
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "epics_insert" on public.epics;
create policy "epics_insert"
on public.epics
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "epics_update" on public.epics;
create policy "epics_update"
on public.epics
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "epics_delete" on public.epics;
create policy "epics_delete"
on public.epics
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "personas_select" on public.personas;
create policy "personas_select"
on public.personas
for select
to authenticated
using (type = 'system' or user_id = auth.uid());

drop policy if exists "personas_insert" on public.personas;
create policy "personas_insert"
on public.personas
for insert
to authenticated
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "personas_update" on public.personas;
create policy "personas_update"
on public.personas
for update
to authenticated
using (type = 'user' and user_id = auth.uid())
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "personas_delete" on public.personas;
create policy "personas_delete"
on public.personas
for delete
to authenticated
using (type = 'user' and user_id = auth.uid());

drop policy if exists "user_feature_settings_select" on public.user_feature_settings;
create policy "user_feature_settings_select"
on public.user_feature_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "user_feature_settings_insert" on public.user_feature_settings;
create policy "user_feature_settings_insert"
on public.user_feature_settings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "user_feature_settings_update" on public.user_feature_settings;
create policy "user_feature_settings_update"
on public.user_feature_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "user_feature_settings_delete" on public.user_feature_settings;
create policy "user_feature_settings_delete"
on public.user_feature_settings
for delete
to authenticated
using (user_id = auth.uid());

insert into public.personas (user_id, code, name, description, type)
select null, 'friendly', 'Friendly', 'Warm and approachable mode', 'system'
where not exists (select 1 from public.personas where user_id is null and code = 'friendly');

insert into public.personas (user_id, code, name, description, type)
select null, 'ai_developer', 'AI Developer', 'Build and ship with AI-first workflow', 'system'
where not exists (select 1 from public.personas where user_id is null and code = 'ai_developer');

insert into public.personas (user_id, code, name, description, type)
select null, 'student', 'Student', 'Learning-oriented execution mode', 'system'
where not exists (select 1 from public.personas where user_id is null and code = 'student');

insert into public.personas (user_id, code, name, description, type)
select null, 'bio_entrepreneur', 'Bio Entrepreneur', 'Biotech founder/operator context', 'system'
where not exists (select 1 from public.personas where user_id is null and code = 'bio_entrepreneur');
