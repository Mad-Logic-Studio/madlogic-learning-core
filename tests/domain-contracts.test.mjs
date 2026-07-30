import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionEnrollmentStatus,
  currentEnrollmentStatus,
  effectiveAccessLinkStatus,
  evaluateAccessLink,
  isEnrollmentActive,
  transitionAccessLink,
  transitionEnrollment,
  validateEnrollment,
} from "../packages/core/dist/index.js";

const enrollment = {
  id: "enrollment_demo",
  learnerId: "learner_demo",
  courseRunId: "run_demo",
  tier: "standard",
  createdAt: "2026-07-30T00:00:00.000Z",
  version: 2,
  statusHistory: [
    { status: "pending", changedAt: "2026-07-30T00:00:00.000Z" },
    { status: "active", changedAt: "2026-07-30T00:01:00.000Z" },
  ],
};

const accessLink = {
  id: "link_demo",
  enrollmentId: enrollment.id,
  tokenDigest: "sha256:synthetic-digest",
  status: "active",
  usagePolicy: "single_use",
  expiresAt: "2026-08-01T00:00:00.000Z",
  createdAt: "2026-07-30T00:00:00.000Z",
  version: 1,
};

test("domain contracts preserve durable enrollment evidence", () => {
  assert.equal(currentEnrollmentStatus(enrollment), "active");
  assert.equal(isEnrollmentActive(enrollment), true);
  assert.deepEqual(validateEnrollment(enrollment), []);
});

test("enrollment transition table accepts valid transitions and rejects invalid ones", () => {
  assert.equal(canTransitionEnrollmentStatus("active", "paused"), true);
  assert.equal(canTransitionEnrollmentStatus("completed", "active"), false);
  const paused = transitionEnrollment(enrollment, "paused", "2026-07-30T00:02:00.000Z", "learner request");
  assert.equal(currentEnrollmentStatus(paused), "paused");
  assert.equal(paused.version, 3);
  assert.equal(paused.statusHistory.length, 3);
  assert.throws(
    () =>
      transitionEnrollment(
        {
          ...enrollment,
          statusHistory: [
            ...enrollment.statusHistory,
            { status: "completed", changedAt: "2026-07-30T00:02:00.000Z" },
          ],
          version: 3,
        },
        "active",
        "2026-07-30T00:03:00.000Z",
      ),
    /Invalid enrollment transition/u,
  );
});

test("invalid enrollment history is detected", () => {
  const issues = validateEnrollment({
    ...enrollment,
    statusHistory: [
      { status: "pending", changedAt: "2026-07-30T00:02:00.000Z" },
      { status: "active", changedAt: "2026-07-30T00:01:00.000Z" },
    ],
  });
  assert.equal(issues.some((issue) => issue.code === "non_monotonic_history"), true);
});

test("access links expire, revoke, and consume without deleting enrollment", () => {
  assert.equal(effectiveAccessLinkStatus(accessLink, "2026-08-01T00:00:00.000Z"), "expired");
  assert.deepEqual(evaluateAccessLink(enrollment, accessLink, "2026-07-31T00:00:00.000Z"), {
    allowed: true,
    enrollmentId: enrollment.id,
    usagePolicy: "single_use",
  });
  const consumed = transitionAccessLink(accessLink, "consumed", "2026-07-30T01:00:00.000Z");
  assert.equal(consumed.status, "consumed");
  assert.equal(consumed.version, 2);
  assert.deepEqual(evaluateAccessLink(enrollment, consumed, "2026-07-30T01:01:00.000Z"), {
    allowed: false,
    reason: "link_consumed",
  });
});

test("reusable access links cannot be consumed", () => {
  assert.throws(
    () => transitionAccessLink({ ...accessLink, usagePolicy: "reusable" }, "consumed", "2026-07-30T01:00:00.000Z"),
    /Reusable access links are not consumed/u,
  );
});
