import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = await Promise.all([
  "20260731002500_extend_access_invitations_and_sessions.sql",
  "20260731002600_add_access_management_functions.sql",
  "20260731002700_add_access_exchange_and_expiration.sql",
].map((name) => readFile(new URL(`../packages/postgres/migrations/${name}`, import.meta.url), "utf8")));
const sql = migrations.join("\n").toLowerCase();

test("access migration adds revocable digest-only sessions without replacing existing concepts", () => {
  for (const required of [
    "create table if not exists public.classroom_sessions",
    "session_digest text not null unique",
    "add column if not exists usage_policy",
    "add column if not exists last_exchanged_at",
    "add column if not exists exchange_count",
    "issue_classroom_access_invitation",
    "exchange_classroom_access_invitation",
    "regenerate_classroom_access_invitation",
    "revoke_classroom_access_invitation",
    "revoke_classroom_entitlement_sessions",
    "expire_classroom_sessions",
    "classroom_sessions_one_active_per_invitation_client",
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
});

test("new invitations are reusable while historical single-use invitation behavior is preserved", () => {
  assert.match(sql, /usage_policy text not null default 'single_use'/u);
  assert.match(sql, /'reusable'/u);
  assert.match(sql, /usage_policy = 'single_use' and invitation\.consumed_at is not null/u);
});

test("session data and elevated functions deny anonymous and authenticated roles", () => {
  assert.match(sql, /alter table public\.classroom_sessions enable row level security/u);
  assert.match(sql, /create policy no_client_access_sessions/u);
  assert.match(sql, /revoke all on public\.classroom_sessions from anon, authenticated/u);
  for (const functionName of [
    "issue_classroom_access_invitation",
    "exchange_classroom_access_invitation",
    "regenerate_classroom_access_invitation",
    "revoke_classroom_access_invitation",
  ]) assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}`, "u"));
});

test("migration protects search paths and emits generic token-free access events", () => {
  assert.match(sql, /security definer\nset search_path = ''/u);
  for (const eventName of [
    "access.invitation_issued",
    "access.invitation_revoked",
    "access.invitation_regenerated",
    "access.invitation_expired",
    "access.session_started",
    "access.session_refreshed",
    "access.session_revoked",
    "access.session_expired",
    "access.denied",
  ]) assert.match(sql, new RegExp(eventName.replace(/[.]/gu, "\\."), "u"));
  assert.doesNotMatch(sql, /raw[_ -]?token/u);
  assert.doesNotMatch(sql, /cookie_value/u);
});

test("migration is additive and does not regress progress or entitlement history", () => {
  for (const prohibited of [
    /\bdrop\s+table\b/u,
    /\btruncate\b/u,
    /\bdelete\s+from\b/u,
    /\bdrop\s+column\b/u,
    /update\s+public\.classroom_lesson_progress/u,
    /delete\s+from\s+public\.classroom_entitlement_status_history/u,
  ]) assert.doesNotMatch(sql, prohibited);
});

test("migration contains no private deployment identifiers or secrets", () => {
  assert.doesNotMatch(sql, /qijossbqgynlocswriun/u);
  assert.doesNotMatch(sql, /socialmedium-classroom/u);
  assert.doesNotMatch(sql, /service[_ -]?role[_ -]?key/u);
  assert.doesNotMatch(sql, /https?:\/\//u);
});
