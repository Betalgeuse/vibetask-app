-- Core Supabase schema for VibeTask (Convex replacement)

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('user', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('user', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete restrict,
  task_name text not null,
  description text,
  due_date bigint not null,
  priority int,
  is_completed boolean not null default false,
  embedding double precision[],
  created_at timestamptz not null default now()
);

create table if not exists public.sub_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete restrict,
  parent_id uuid not null references public.todos(id) on delete cascade,
  task_name text not null,
  description text,
  due_date bigint not null,
  priority int,
  is_completed boolean not null default false,
  embedding double precision[],
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_labels_user_id on public.labels(user_id);
create index if not exists idx_todos_user_id on public.todos(user_id);
create index if not exists idx_todos_project_id on public.todos(project_id);
create index if not exists idx_todos_due_date on public.todos(due_date);
create index if not exists idx_todos_is_completed on public.todos(is_completed);
create index if not exists idx_sub_todos_user_id on public.sub_todos(user_id);
create index if not exists idx_sub_todos_parent_id on public.sub_todos(parent_id);
create index if not exists idx_sub_todos_project_id on public.sub_todos(project_id);

alter table public.projects enable row level security;
alter table public.labels enable row level security;
alter table public.todos enable row level security;
alter table public.sub_todos enable row level security;

drop policy if exists "projects_select" on public.projects;
create policy "projects_select"
on public.projects
for select
to authenticated
using (type = 'system' or user_id = auth.uid());

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert"
on public.projects
for insert
to authenticated
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "projects_update" on public.projects;
create policy "projects_update"
on public.projects
for update
to authenticated
using (type = 'user' and user_id = auth.uid())
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete"
on public.projects
for delete
to authenticated
using (type = 'user' and user_id = auth.uid());

drop policy if exists "labels_select" on public.labels;
create policy "labels_select"
on public.labels
for select
to authenticated
using (type = 'system' or user_id = auth.uid());

drop policy if exists "labels_insert" on public.labels;
create policy "labels_insert"
on public.labels
for insert
to authenticated
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "labels_update" on public.labels;
create policy "labels_update"
on public.labels
for update
to authenticated
using (type = 'user' and user_id = auth.uid())
with check (type = 'user' and user_id = auth.uid());

drop policy if exists "labels_delete" on public.labels;
create policy "labels_delete"
on public.labels
for delete
to authenticated
using (type = 'user' and user_id = auth.uid());

drop policy if exists "todos_select" on public.todos;
create policy "todos_select"
on public.todos
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "todos_insert" on public.todos;
create policy "todos_insert"
on public.todos
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "todos_update" on public.todos;
create policy "todos_update"
on public.todos
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "todos_delete" on public.todos;
create policy "todos_delete"
on public.todos
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "sub_todos_select" on public.sub_todos;
create policy "sub_todos_select"
on public.sub_todos
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "sub_todos_insert" on public.sub_todos;
create policy "sub_todos_insert"
on public.sub_todos
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "sub_todos_update" on public.sub_todos;
create policy "sub_todos_update"
on public.sub_todos
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "sub_todos_delete" on public.sub_todos;
create policy "sub_todos_delete"
on public.sub_todos
for delete
to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from public.projects
    where user_id is null and type = 'system' and name = 'Inbox'
  ) then
    insert into public.projects (user_id, name, type)
    values (null, 'Inbox', 'system');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from public.labels
    where user_id is null and type = 'system' and name = 'AI'
  ) then
    insert into public.labels (user_id, name, type)
    values (null, 'AI', 'system');
  end if;
end
$$;
