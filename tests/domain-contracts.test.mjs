import assert from "node:assert/strict";
import test from "node:test";
import { currentEnrollmentStatus, isEnrollmentActive } from "../packages/core/dist/index.js";

const enrollment = {
  id: "enrollment_demo",
  learnerId: "learner_demo",
  courseRunId: "run_demo",
  tier: "standard",
  createdAt: "2026-07-30T00:00:00.000Z",
  statusHistory: [
    { status: "pending", changedAt: "2026-07-30T00:00:00.000Z" },
    { status: "active", changedAt: "2026-07-30T00:01:00.000Z" },
  ],
};

test("domain contracts are importable and preserve enrollment history", () => {
  assert.equal(currentEnrollmentStatus(enrollment), "active");
  assert.equal(isEnrollmentActive(enrollment), true);
  assert.equal(enrollment.statusHistory.length, 2);
});

test("an enrollment without status evidence is rejected", () => {
  assert.throws(() => currentEnrollmentStatus({ ...enrollment, statusHistory: [] }), /must not be empty/u);
});
