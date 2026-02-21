-- V3 Eisenhower priority/status layer with backward-compatible legacy field sync

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'todo_priority_quadrant'
      and n.nspname = 'public'
  ) then
    create type public.todo_priority_quadrant as enum (
      'doFirst',
      'schedule',
      'delegate',
      'eliminate'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'todo_status'
      and n.nspname = 'public'
  ) then
    create type public.todo_status as enum (
      'TODO',
      'IN_PROGRESS',
      'DONE'
    );
  end if;
end
$$;

alter table public.todos
  add column if not exists priority_quadrant public.todo_priority_quadrant,
  add column if not exists status public.todo_status;

alter table public.sub_todos
  add column if not exists priority_quadrant public.todo_priority_quadrant,
  add column if not exists status public.todo_status;

update public.todos
set
  priority_quadrant = case
    when coalesce(priority, 1) = 2 then 'schedule'::public.todo_priority_quadrant
    when coalesce(priority, 1) = 3 then 'delegate'::public.todo_priority_quadrant
    when coalesce(priority, 1) = 4 then 'eliminate'::public.todo_priority_quadrant
    else 'doFirst'::public.todo_priority_quadrant
  end,
  status = case
    when coalesce(is_completed, false) then 'DONE'::public.todo_status
    else 'TODO'::public.todo_status
  end
where priority_quadrant is null
   or status is null;

update public.sub_todos
set
  priority_quadrant = case
    when coalesce(priority, 1) = 2 then 'schedule'::public.todo_priority_quadrant
    when coalesce(priority, 1) = 3 then 'delegate'::public.todo_priority_quadrant
    when coalesce(priority, 1) = 4 then 'eliminate'::public.todo_priority_quadrant
    else 'doFirst'::public.todo_priority_quadrant
  end,
  status = case
    when coalesce(is_completed, false) then 'DONE'::public.todo_status
    else 'TODO'::public.todo_status
  end
where priority_quadrant is null
   or status is null;

alter table public.todos
  alter column priority_quadrant set default 'doFirst'::public.todo_priority_quadrant,
  alter column priority_quadrant set not null,
  alter column status set default 'TODO'::public.todo_status,
  alter column status set not null;

alter table public.sub_todos
  alter column priority_quadrant set default 'doFirst'::public.todo_priority_quadrant,
  alter column priority_quadrant set not null,
  alter column status set default 'TODO'::public.todo_status,
  alter column status set not null;

create or replace function public.sync_todo_v3_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.priority_quadrant is distinct from old.priority_quadrant then
      null;
    elsif new.priority is distinct from old.priority or new.priority_quadrant is null then
      new.priority_quadrant := case
        when coalesce(new.priority, 1) = 2 then 'schedule'::public.todo_priority_quadrant
        when coalesce(new.priority, 1) = 3 then 'delegate'::public.todo_priority_quadrant
        when coalesce(new.priority, 1) = 4 then 'eliminate'::public.todo_priority_quadrant
        else 'doFirst'::public.todo_priority_quadrant
      end;
    end if;

    if new.status is distinct from old.status then
      null;
    elsif new.is_completed is distinct from old.is_completed or new.status is null then
      new.status := case
        when coalesce(new.is_completed, false) then 'DONE'::public.todo_status
        else 'TODO'::public.todo_status
      end;
    end if;
  else
    if new.priority_quadrant is null then
      new.priority_quadrant := case
        when coalesce(new.priority, 1) = 2 then 'schedule'::public.todo_priority_quadrant
        when coalesce(new.priority, 1) = 3 then 'delegate'::public.todo_priority_quadrant
        when coalesce(new.priority, 1) = 4 then 'eliminate'::public.todo_priority_quadrant
        else 'doFirst'::public.todo_priority_quadrant
      end;
    end if;

    if new.status is null then
      new.status := case
        when coalesce(new.is_completed, false) then 'DONE'::public.todo_status
        else 'TODO'::public.todo_status
      end;
    end if;
  end if;

  new.priority := case new.priority_quadrant
    when 'doFirst'::public.todo_priority_quadrant then 1
    when 'schedule'::public.todo_priority_quadrant then 2
    when 'delegate'::public.todo_priority_quadrant then 3
    when 'eliminate'::public.todo_priority_quadrant then 4
  end;

  new.is_completed := (new.status = 'DONE'::public.todo_status);

  return new;
end;
$$;

drop trigger if exists trg_todos_sync_v3_fields on public.todos;
create trigger trg_todos_sync_v3_fields
before insert or update on public.todos
for each row
execute function public.sync_todo_v3_fields();

drop trigger if exists trg_sub_todos_sync_v3_fields on public.sub_todos;
create trigger trg_sub_todos_sync_v3_fields
before insert or update on public.sub_todos
for each row
execute function public.sync_todo_v3_fields();

create index if not exists idx_todos_status on public.todos(status);
create index if not exists idx_sub_todos_status on public.sub_todos(status);
create index if not exists idx_todos_priority_quadrant on public.todos(priority_quadrant);
create index if not exists idx_sub_todos_priority_quadrant on public.sub_todos(priority_quadrant);
