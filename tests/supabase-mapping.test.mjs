import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveClassroomAccessLinkStatus,
  mapClassroomAccessLink,
  mapClassroomCourse,
  mapClassroomEnrollment,
  mapClassroomLessonProgress,
} from "../packages/postgres/dist/index.js";

const now = "2026-07-30T23:55:00.000Z";

test("course mapping sorts lesson identifiers by position", () => {
  const course = mapClassroomCourse(
    {
      id: "course_demo",
      slug: "demo-course",
      title: "Demo Course",
      description: "A synthetic course.",
      status: "published",
      created_at: "2026-07-30T00:00:00.000Z",
    },
    [
      { id: "lesson_two", course_id: "course_demo", slug: "lesson-two", title: "Two", position: 2 },
      { id: "lesson_one", course_id: "course_demo", slug: "lesson-one", title: "One", position: 1 },
    ],
  );

  assert.deepEqual(course.lessonIds, ["lesson_one", "lesson_two"]);
});

test("entitlement mapping preserves pending evidence and maps purchase reversals to revoked", () => {
  const enrollment = mapClassroomEnrollment(
    {
      id: "entitlement_demo",
      user_id: "learner_demo",
      cohort_id: "cohort_demo",
      tier: "standard",
      status: "refunded",
      version: 4,
      created_at: "2026-07-30T00:00:00.000Z",
    },
    [
      {
        sequence: 1,
        status: "pending",
        source_status: "pending",
        reason: "entitlement_created",
        changed_at: "2026-07-30T00:00:00.000Z",
      },
      {
        sequence: 2,
        status: "active",
        source_status: "active",
        reason: "entitlement_created",
        changed_at: "2026-07-30T00:00:00.000Z",
      },
      {
        sequence: 3,
        status: "revoked",
        source_status: "refunded",
        reason: "status_changed",
        changed_at: "2026-07-30T01:00:00.000Z",
      },
    ],
  );

  assert.deepEqual(
    enrollment.statusHistory.map((record) => record.status),
    ["pending", "active", "revoked"],
  );
  assert.equal(enrollment.version, 4);
});

test("access invitation mapping derives consumed, revoked, and expired states without raw tokens", () => {
  const base = {
    id: "invitation_demo",
    entitlement_id: "entitlement_demo",
    invitation_digest: "a".repeat(64),
    expires_at: "2026-07-31T00:00:00.000Z",
    consumed_at: null,
    invalidated_at: null,
    version: 2,
    created_at: "2026-07-30T00:00:00.000Z",
  };

  assert.equal(deriveClassroomAccessLinkStatus(base, now), "active");
  assert.equal(deriveClassroomAccessLinkStatus({ ...base, consumed_at: now }, now), "consumed");
  assert.equal(deriveClassroomAccessLinkStatus({ ...base, invalidated_at: now }, now), "revoked");
  assert.equal(
    deriveClassroomAccessLinkStatus({ ...base, expires_at: "2026-07-29T00:00:00.000Z" }, now),
    "expired",
  );

  const mapped = mapClassroomAccessLink({ ...base, consumed_at: now }, now);
  assert.equal(mapped.tokenDigest, "a".repeat(64));
  assert.equal(mapped.usagePolicy, "single_use");
  assert.equal(mapped.consumedAt, now);
});

test("lesson progress mapping preserves state timestamps", () => {
  const progress = mapClassroomLessonProgress({
    entitlement_id: "entitlement_demo",
    lesson_id: "lesson_demo",
    state: "completed",
    started_at: "2026-07-30T01:00:00.000Z",
    completed_at: "2026-07-30T01:30:00.000Z",
    updated_at: "2026-07-30T01:30:00.000Z",
  });

  assert.equal(progress.state, "completed");
  assert.equal(progress.startedAt, "2026-07-30T01:00:00.000Z");
  assert.equal(progress.completedAt, "2026-07-30T01:30:00.000Z");
});
