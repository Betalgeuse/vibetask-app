/**
 * Obsidian To-do → VibeTask Supabase Seeder
 *
 * 대상 계정: zzzaydenzz@gmail.com
 * 소스: /Users/zayden/obsidian/vault/To-do/*.md
 *
 * 실행: node scripts/seed-from-obsidian.mjs
 *       node scripts/seed-from-obsidian.mjs --dry-run   (실제 insert 없이 파싱 결과만 출력)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

// --- 환경변수 로드 ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");
config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TARGET_EMAIL = "zzzaydenzz@gmail.com";
const VAULT_TODO_PATH = "/Users/zayden/obsidian/vault/To-do";
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- 파싱 헬퍼 ---

const parseWorkflowStatus = (raw = "") => {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("today")) return "TODAY";
  if (s.startsWith("this week")) return "THIS_WEEK";
  if (s.startsWith("next week")) return "NEXT_WEEK";
  if (s === "done") return "DONE";
  if (s === "cancel") return "CANCEL";
  if (s === "backlog") return "BACKLOG";
  return "BACKLOG";
};

// workflow_status → kanban status 매핑
// TODAY/THIS_WEEK → IN_PROGRESS, DONE → DONE, 나머지 → TODO
const workflowStatusToTodoStatus = (wf) => {
  if (wf === "DONE") return "DONE";
  if (wf === "TODAY" || wf === "THIS_WEEK") return "IN_PROGRESS";
  return "TODO"; // BACKLOG, NEXT_WEEK, CANCEL
};

const parsePriorityQuadrant = (raw = "") => {
  const s = raw.trim();
  if (s.startsWith("1")) return "doFirst";    // 1.급중
  if (s.startsWith("2")) return "schedule";   // 2안급중
  if (s.startsWith("3")) return "delegate";   // 3.급안중
  if (s === "안급안중") return "eliminate";
  return "doFirst";
};

const parseWorkload = (raw = "") => {
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  return Math.min(Math.max(Math.round(n * 25), 1), 100); // 0.5→13, 1→25, 2→50, 3→75, 4→100
};

const parseFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val) result[key] = val;
  }
  return result;
};

// --- 메인 ---

const main = async () => {
  console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}VibeTask Obsidian Seeder 시작`);
  console.log(`대상 계정: ${TARGET_EMAIL}\n`);

  // 1. 유저 조회 (service role 로 auth.users 접근)
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (userErr) { console.error("유저 목록 조회 실패:", userErr.message); process.exit(1); }

  const targetUser = users.find((u) => u.email === TARGET_EMAIL);
  if (!targetUser) {
    console.error(`계정을 찾을 수 없습니다: ${TARGET_EMAIL}`);
    console.log("가입된 계정 목록:", users.map((u) => u.email).join(", "));
    process.exit(1);
  }
  const userId = targetUser.id;
  console.log(`유저 확인: ${TARGET_EMAIL} (${userId})`);

  // 2. 기본 project 확인 / 생성 (Obsidian Import)
  let projectId;
  {
    const { data: existing } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", "Obsidian Import")
      .single();

    if (existing) {
      projectId = existing.id;
      console.log(`기존 프로젝트 사용: Obsidian Import (${projectId})`);
    } else if (!DRY_RUN) {
      const { data: created, error } = await supabase
        .from("projects")
        .insert({ user_id: userId, name: "Obsidian Import", type: "user" })
        .select("id")
        .single();
      if (error) { console.error("프로젝트 생성 실패:", error.message); process.exit(1); }
      projectId = created.id;
      console.log(`프로젝트 생성: Obsidian Import (${projectId})`);
    } else {
      projectId = "dry-run-project-id";
    }
  }

  // 3. 기본 label 확인 / 생성 (General)
  let labelId;
  {
    const { data: existing } = await supabase
      .from("labels")
      .select("id")
      .eq("user_id", userId)
      .eq("name", "General")
      .single();

    if (existing) {
      labelId = existing.id;
      console.log(`기존 레이블 사용: General (${labelId})`);
    } else if (!DRY_RUN) {
      const { data: created, error } = await supabase
        .from("labels")
        .insert({ user_id: userId, name: "General", type: "user" })
        .select("id")
        .single();
      if (error) { console.error("레이블 생성 실패:", error.message); process.exit(1); }
      labelId = created.id;
      console.log(`레이블 생성: General (${labelId})`);
    } else {
      labelId = "dry-run-label-id";
    }
  }

  // 4. epic 캐시 (이름 → id)
  const epicCache = new Map();
  const getOrCreateEpic = async (name) => {
    if (!name) return null;
    if (epicCache.has(name)) return epicCache.get(name);

    const { data: existing } = await supabase
      .from("epics")
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .single();

    if (existing) {
      epicCache.set(name, existing.id);
      return existing.id;
    }
    if (DRY_RUN) {
      epicCache.set(name, `dry-epic-${name}`);
      return epicCache.get(name);
    }
    const { data: created, error } = await supabase
      .from("epics")
      .insert({ user_id: userId, name })
      .select("id")
      .single();
    if (error) { console.warn(`  에픽 생성 실패 (${name}): ${error.message}`); return null; }
    epicCache.set(name, created.id);
    return created.id;
  };

  // 5. persona 캐시 (이름 → id)
  const personaCache = new Map();
  const getOrCreatePersona = async (name) => {
    if (!name) return null;
    if (personaCache.has(name)) return personaCache.get(name);

    const code = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    const { data: existing } = await supabase
      .from("personas")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", name)
      .single();

    if (existing) {
      personaCache.set(name, existing.id);
      return existing.id;
    }
    if (DRY_RUN) {
      personaCache.set(name, `dry-persona-${name}`);
      return personaCache.get(name);
    }
    const { data: created, error } = await supabase
      .from("personas")
      .insert({ user_id: userId, code, name, type: "user" })
      .select("id")
      .single();
    if (error) { console.warn(`  페르소나 생성 실패 (${name}): ${error.message}`); return null; }
    personaCache.set(name, created.id);
    return created.id;
  };

  // 6. 파일 파싱 및 insert
  const files = fs.readdirSync(VAULT_TODO_PATH).filter((f) => f.endsWith(".md"));
  console.log(`\nTo-do 파일 ${files.length}개 처리 시작...\n`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const taskName = file.replace(/\.md$/, "").trim();
    const content = fs.readFileSync(path.join(VAULT_TODO_PATH, file), "utf-8");
    const fm = parseFrontmatter(content);

    const workflowStatus = parseWorkflowStatus(fm["상태"]);
    const priorityQuadrant = parsePriorityQuadrant(fm["우선순위"]);
    const todoStatus = workflowStatusToTodoStatus(workflowStatus);
    const isCompleted = workflowStatus === "DONE";
    const workload = parseWorkload(fm["Workload(<4)"]);
    const story = fm["Story"] || null;

    const epicId = await getOrCreateEpic(fm["Epic"] || null);
    const personaId = await getOrCreatePersona(fm["Persona"] || null);

    const row = {
      user_id: userId,
      project_id: projectId,
      label_id: labelId,
      task_name: taskName,
      due_date: 0,
      status: todoStatus,
      is_completed: isCompleted,
      workflow_status: workflowStatus,
      priority_quadrant: priorityQuadrant,
      ...(workload !== null && { workload }),
      ...(story && { story }),
      ...(epicId && { epic_id: epicId }),
      ...(personaId && { persona_id: personaId }),
    };

    if (DRY_RUN) {
      console.log(`[DRY] ${taskName}`);
      console.log(`      상태=${workflowStatus} → status=${todoStatus} 우선순위=${priorityQuadrant} epic=${fm["Epic"] || "-"} persona=${fm["Persona"] || "-"}`);
      inserted++;
      continue;
    }

    // 중복 방지: 같은 user_id + task_name이면 skip
    const { data: dup } = await supabase
      .from("todos")
      .select("id")
      .eq("user_id", userId)
      .eq("task_name", taskName)
      .single();

    if (dup) {
      console.log(`  SKIP (이미 존재): ${taskName}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("todos").insert(row);
    if (error) {
      console.error(`  FAIL: ${taskName} — ${error.message}`);
      failed++;
    } else {
      console.log(`  OK: ${taskName}`);
      inserted++;
    }
  }

  console.log(`\n완료: inserted=${inserted}, skipped=${skipped}, failed=${failed}, total=${files.length}`);
  if (epicCache.size > 0) console.log(`에픽 생성/재사용: ${[...epicCache.keys()].join(", ")}`);
  if (personaCache.size > 0) console.log(`페르소나 생성/재사용: ${[...personaCache.keys()].join(", ")}`);
};

main().catch((e) => { console.error(e); process.exit(1); });
