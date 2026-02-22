# Legacy Prisma/Jira Schema Cleanup (Supabase)

이 문서는 현재 서비스에서 사용하지 않는 레거시 Prisma/Jira 테이블(`Issue`, `Project`, `Sprint`, `User`, `_prisma_migrations`)을 정리하기 위한 SQL을 제공합니다.

## 대상

- 삭제 대상(레거시):
  - `public."Issue"`
  - `public."Project"`
  - `public."Sprint"`
  - `public."User"`
  - `public._prisma_migrations`
- 유지 대상(현재 서비스 사용):
  - `public.projects`
  - `public.labels`
  - `public.todos`
  - `public.sub_todos`

## 주의사항

- **파괴적 작업**입니다. 실행 전 DB 백업(스냅샷) 권장.
- Supabase SQL Editor에서 실행 가능.
- 대소문자 테이블명(`"Issue"` 등) 주의.

---

## 실행 SQL

```sql
begin;

-- Optional: 너무 오래 잠기지 않게
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1) 레거시 Prisma 테이블 삭제 (대소문자 테이블명 주의)
drop table if exists public."Issue" cascade;
drop table if exists public."Sprint" cascade;
drop table if exists public."Project" cascade;
drop table if exists public."User" cascade;

-- 2) Prisma migration 메타 테이블 삭제 (필요 없으면)
drop table if exists public._prisma_migrations cascade;

-- 3) 레거시 enum 타입 정리 (남아있으면 삭제)
do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name, t.typname as type_name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typtype = 'e'
      and n.nspname = 'public'
      and (
        t.typname in (
          'IssueStatus','IssuePriority','IssueQuadrant','SprintStatus',
          'issuestatus','issuepriority','issuequadrant','sprintstatus'
        )
        or t.typname ~* '^(issue|sprint).*(status|priority|quadrant)$'
      )
  loop
    execute format('drop type if exists %I.%I cascade', r.schema_name, r.type_name);
  end loop;
end $$;

commit;
```

---

## 실행 후 확인 쿼리

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

기대 결과:

- 남아있어야 하는 핵심 테이블: `labels`, `projects`, `sub_todos`, `todos`
- 위 레거시 5개 테이블은 목록에서 사라져야 함.
