import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const persistenceMigrationUrl = new URL(
  "../packages/postgres/migrations/20260730235500_add_learning_persistence.sql",
  import.meta.url,
);
const hardeningMigrationUrl = new URL(
  "../packages/postgres/migrations/20260730235600_harden_classroom_internal_access.sql",
  import.meta.url,
);

const persistenceSql = await readFile(persistenceMigrationUrl, "utf8");
const hardeningSql = await readFile(hardeningMigrationUrl, "utf8");
const allSql = `${persistenceSql}\n${hardeningSql}`.toLowerCase();

test("persistence migration is additive and contains the required learning tables", () => {
  for (const required of [
    "create table if not exists public.classroom_courses",
    "create table if not exists public.classroom_lessons",
    "create table if not exists public.classroom_lesson_progress",
    "create table if not exists public.classroom_entitlement_status_history",
    "create table if not exists public.classroom_idempotency_records",
    "create table if not exists public.classroom_outbox_events",
    "add column if not exists course_id uuid",
    "add column if not exists lesson_id uuid",
    "add column if not exists version integer not null default 1",
  ]) {
    assert.match(allSql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
});

test("migration avoids destructive data operations", () => {
  for (const prohibited of [
    /\bdrop\s+table\b/u,
    /\btruncate\b/u,
    /\bdelete\s+from\b/u,
    /\bdrop\s+column\b/u,
    /\balter\s+column\s+[^;]+\s+type\b/u,
  ]) {
    assert.doesNotMatch(allSql, prohibited);
  }
});

test("learner-facing tables use RLS and internal tables deny client access", () => {
  for (const table of [
    "classroom_courses",
    "classroom_lessons",
    "classroom_lesson_progress",
    "classroom_entitlement_status_history",
    "classroom_idempotency_records",
    "classroom_outbox_events",
  ]) {
    assert.match(allSql, new RegExp(`alter table public\\.${table} enable row level security`, "u"));
  }

  assert.match(allSql, /no_client_access_idempotency/u);
  assert.match(allSql, /no_client_access_outbox/u);
  assert.match(allSql, /no_client_access_invitations/u);
  assert.match(allSql, /revoke execute on function public\.rls_auto_enable\(\)/u);
});

test("migration models digest-only access and contains no deployment secrets", () => {
  assert.match(allSql, /invitation_digest/u);
  assert.doesNotMatch(allSql, /raw[_ -]?token/u);
  assert.doesNotMatch(allSql, /service[_ -]?role[_ -]?key/u);
  assert.doesNotMatch(allSql, /qijossbqgynlocswriun/u);
  assert.doesNotMatch(allSql, /socialmedium-classroom/u);
});
