-- V8 calendar foundations: store Google Calendar OAuth tokens per user.

create table if not exists public.user_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_calendar_tokens_token_presence_chk
    check (
      coalesce(length(nullif(access_token, '')), 0) > 0
      or coalesce(length(nullif(refresh_token, '')), 0) > 0
    )
);

create index if not exists idx_user_calendar_tokens_expires_at
  on public.user_calendar_tokens(expires_at);

create or replace function public.set_user_calendar_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_user_calendar_tokens_updated_at
  on public.user_calendar_tokens;

create trigger trg_user_calendar_tokens_updated_at
before update on public.user_calendar_tokens
for each row
execute function public.set_user_calendar_tokens_updated_at();

alter table public.user_calendar_tokens enable row level security;

drop policy if exists "user_calendar_tokens_select_own" on public.user_calendar_tokens;
create policy "user_calendar_tokens_select_own"
on public.user_calendar_tokens
for select
using (auth.uid() = user_id);

drop policy if exists "user_calendar_tokens_insert_own" on public.user_calendar_tokens;
create policy "user_calendar_tokens_insert_own"
on public.user_calendar_tokens
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_calendar_tokens_update_own" on public.user_calendar_tokens;
create policy "user_calendar_tokens_update_own"
on public.user_calendar_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_calendar_tokens_delete_own" on public.user_calendar_tokens;
create policy "user_calendar_tokens_delete_own"
on public.user_calendar_tokens
for delete
using (auth.uid() = user_id);
