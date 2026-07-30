import assert from "node:assert/strict";
import test from "node:test";
import { transitionEnrollment } from "../packages/core/dist/index.js";
import {
  createInMemoryPersistenceFixture,
  exerciseEnrollmentRepositoryContract,
} from "../packages/postgres/dist/index.js";

const initialEnrollment = {
  id: "enrollment_fixture",
  learnerId: "learner_fixture",
  courseRunId: "run_fixture",
  tier: "generic",
  statusHistory: [{ status: "pending", changedAt: "2026-07-30T00:00:00.000Z" }],
  version: 1,
  createdAt: "2026-07-30T00:00:00.000Z",
};

const activeEnrollment = transitionEnrollment(initialEnrollment, "active", "2026-07-30T00:01:00.000Z");

const event = {
  id: "event_fixture",
  name: "enrollment.status_changed",
  occurredAt: "2026-07-30T00:01:00.000Z",
  enrollmentId: initialEnrollment.id,
  payload: { status: "active" },
};

test("in-memory enrollment repository passes the public conformance harness", async () => {
  const fixture = createInMemoryPersistenceFixture();
  const result = await exerciseEnrollmentRepositoryContract(fixture.enrollments, initialEnrollment, activeEnrollment);
  assert.deepEqual(result.checks, ["insert-and-load", "expected-version-update", "missing-is-null"]);
});

test("optimistic concurrency rejects stale writers", async () => {
  const fixture = createInMemoryPersistenceFixture();
  await fixture.enrollments.save(initialEnrollment, { expectedVersion: null });
  await fixture.enrollments.save(activeEnrollment, { expectedVersion: 1 });
  await assert.rejects(
    fixture.enrollments.save({ ...activeEnrollment, version: 2 }, { expectedVersion: 1 }),
    (error) => error?.code === "concurrency_conflict",
  );
});

test("idempotency replay returns the original claim and rejects changed requests", async () => {
  const fixture = createInMemoryPersistenceFixture();
  const claim = {
    key: "enrollment.activate:fixture",
    operation: "enrollment.activate",
    requestHash: "sha256:request-a",
    status: "started",
    createdAt: "2026-07-30T00:00:00.000Z",
  };
  const first = await fixture.idempotency.claim(claim);
  const replay = await fixture.idempotency.claim(claim);
  assert.deepEqual(replay, first);
  await assert.rejects(
    fixture.idempotency.claim({ ...claim, requestHash: "sha256:request-b" }),
    (error) => error?.code === "idempotency_conflict",
  );
});

test("unit of work commits enrollment and outbox atomically", async () => {
  const fixture = createInMemoryPersistenceFixture();
  await assert.rejects(
    fixture.unitOfWork.transaction(async (context) => {
      await fixture.enrollments.save(initialEnrollment, { expectedVersion: null }, context);
      await fixture.outbox.append({ id: "outbox-rollback", event, occurredAt: event.occurredAt }, context);
      throw new Error("synthetic rollback");
    }),
    /synthetic rollback/u,
  );
  assert.equal(await fixture.enrollments.findById(initialEnrollment.id), null);
  assert.deepEqual(await fixture.outbox.listPending(), []);

  await fixture.unitOfWork.transaction(async (context) => {
    await fixture.enrollments.save(initialEnrollment, { expectedVersion: null }, context);
    await fixture.outbox.append({ id: "outbox-commit", event, occurredAt: event.occurredAt }, context);
  });
  assert.equal((await fixture.enrollments.findById(initialEnrollment.id))?.version, 1);
  assert.equal((await fixture.outbox.listPending()).length, 1);
});
