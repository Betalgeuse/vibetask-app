-- Patch for projects that already ran v4: remove seeded/system personas and enforce user-owned custom personas only.

delete from public.personas
where user_id is null
   or type <> 'user';

alter table public.personas
  alter column user_id set not null,
  alter column type set default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'personas_user_only_type_chk'
      and conrelid = 'public.personas'::regclass
  ) then
    alter table public.personas
      add constraint personas_user_only_type_chk
      check (type = 'user');
  end if;
end
$$;

drop policy if exists "personas_select" on public.personas;
create policy "personas_select"
on public.personas
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "personas_insert" on public.personas;
create policy "personas_insert"
on public.personas
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "personas_update" on public.personas;
create policy "personas_update"
on public.personas
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personas_delete" on public.personas;
create policy "personas_delete"
on public.personas
for delete
to authenticated
using (user_id = auth.uid());
