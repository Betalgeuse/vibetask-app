alter table public.labels
add column if not exists color text;

update public.labels
set color = '#6366f1'
where color is null or btrim(color) = '';

alter table public.labels
alter column color set default '#6366f1';

alter table public.labels
alter column color set not null;
