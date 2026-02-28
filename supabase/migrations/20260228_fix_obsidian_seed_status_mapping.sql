-- Fix: workflow_status → status 매핑 오류 수정
--
-- 문제: seed-from-obsidian.mjs 가 status 를 명시하지 않아
--       V3 트리거가 is_completed 기반으로만 status 를 결정했음.
--       결과적으로 TODAY/THIS_WEEK 태스크가 모두 status='TODO' 로 저장됨.
--
-- 수정: workflow_status 값 기준으로 status 를 재계산
--       TODAY / THIS_WEEK → IN_PROGRESS
--       DONE              → DONE
--       BACKLOG / NEXT_WEEK / CANCEL → TODO

-- 트리거가 재정의하지 않도록 status 를 직접 업데이트
-- (트리거는 status 가 명시적으로 변경될 때 is_completed 를 동기화함)

update public.todos
set
  status = case workflow_status
    when 'TODAY'     then 'IN_PROGRESS'::public.todo_status
    when 'THIS_WEEK' then 'IN_PROGRESS'::public.todo_status
    when 'DONE'      then 'DONE'::public.todo_status
    else                  'TODO'::public.todo_status
  end
where
  -- status 가 실제 workflow_status 와 불일치하는 행만 대상
  status <> case workflow_status
    when 'TODAY'     then 'IN_PROGRESS'::public.todo_status
    when 'THIS_WEEK' then 'IN_PROGRESS'::public.todo_status
    when 'DONE'      then 'DONE'::public.todo_status
    else                  'TODO'::public.todo_status
  end;

-- sub_todos 도 동일하게 적용
update public.sub_todos
set
  status = case workflow_status
    when 'TODAY'     then 'IN_PROGRESS'::public.todo_status
    when 'THIS_WEEK' then 'IN_PROGRESS'::public.todo_status
    when 'DONE'      then 'DONE'::public.todo_status
    else                  'TODO'::public.todo_status
  end
where
  status <> case workflow_status
    when 'TODAY'     then 'IN_PROGRESS'::public.todo_status
    when 'THIS_WEEK' then 'IN_PROGRESS'::public.todo_status
    when 'DONE'      then 'DONE'::public.todo_status
    else                  'TODO'::public.todo_status
  end;
