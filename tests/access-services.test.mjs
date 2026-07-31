import assert from "node:assert/strict";
import test from "node:test";
import {
  AccessServiceError,
  OneClickAccessService,
  createCleanRedirect,
  generateOpaqueToken,
} from "../packages/core/dist/access.js";
import {
  CloudflareRedirectResponseFactory,
  CloudflareSessionCookieWriter,
  WebCryptoAccessDigestService,
  WebCryptoSecureRandomSource,
  redactAccessSecrets,
} from "../packages/cloudflare/dist/index.js";

const iso = (value) => value;
const hash = (character) => character.repeat(64);

class MemoryInvitationStore {
  constructor() { this.rows = new Map(); }
  async findById(id) { return this.rows.get(id) ?? null; }
  async findByDigest(digest) { return [...this.rows.values()].find((row) => row.tokenDigest === digest) ?? null; }
  async listActiveByEnrollment(enrollmentId) {
    return [...this.rows.values()].filter((row) => row.enrollmentId === enrollmentId && row.status === "active");
  }
  async listExpiring(atOrBefore) {
    return [...this.rows.values()].filter((row) => row.status === "active" && Date.parse(row.expiresAt) <= Date.parse(atOrBefore));
  }
  async save(row, expectedVersion) {
    const current = this.rows.get(row.id);
    if (expectedVersion === null) {
      if (current) throw new Error("duplicate invitation");
    } else if (!current || current.version !== expectedVersion) {
      throw new Error("stale invitation");
    }
    this.rows.set(row.id, structuredClone(row));
  }
}

class MemorySessionStore {
  constructor() { this.rows = new Map(); }
  async findById(id) { return this.rows.get(id) ?? null; }
  async findByDigest(digest) { return [...this.rows.values()].find((row) => row.sessionDigest === digest) ?? null; }
  async listActiveByEnrollment(enrollmentId) {
    return [...this.rows.values()].filter((row) => row.enrollmentId === enrollmentId && row.status === "active");
  }
  async listActiveByInvitation(invitationId) {
    return [...this.rows.values()].filter((row) => row.invitationId === invitationId && row.status === "active");
  }
  async listExpiring(atOrBefore) {
    return [...this.rows.values()].filter((row) => row.status === "active" && Date.parse(row.expiresAt) <= Date.parse(atOrBefore));
  }
  async save(row, expectedVersion) {
    const current = this.rows.get(row.id);
    if (expectedVersion === null) {
      if (current) throw new Error("duplicate session");
    } else if (!current || current.version !== expectedVersion) {
      throw new Error("stale session");
    }
    this.rows.set(row.id, structuredClone(row));
  }
}

class MemoryIdempotencyStore {
  constructor() { this.rows = new Map(); }
  async claim(operation, key, requestHash) {
    const composite = `${operation}:${key}`;
    const current = this.rows.get(composite);
    if (!current) {
      this.rows.set(composite, { requestHash, status: "started" });
      return { outcome: "claimed" };
    }
    if (current.requestHash !== requestHash) return { outcome: "conflict" };
    if (current.status === "completed") return { outcome: "replay", responseReference: current.responseReference };
    return { outcome: "conflict" };
  }
  async complete(operation, key, responseReference) {
    const composite = `${operation}:${key}`;
    const current = this.rows.get(composite);
    if (!current) throw new Error("claim missing");
    this.rows.set(composite, { ...current, status: "completed", responseReference });
  }
}

class SerialTransactions {
  constructor() { this.tail = Promise.resolve(); }
  transaction(operation) {
    const run = this.tail.then(operation, operation);
    this.tail = run.then(() => undefined, () => undefined);
    return run;
  }
}

function createHarness() {
  const invitations = new MemoryInvitationStore();
  const sessions = new MemorySessionStore();
  const idempotency = new MemoryIdempotencyStore();
  const events = [];
  const clock = { value: iso("2026-07-31T00:00:00.000Z"), now() { return this.value; } };
  let invitationSequence = 0;
  let sessionSequence = 0;
  let eventSequence = 0;
  const enrollment = {
    id: "enrollment-1",
    learnerId: "learner-1",
    courseRunId: "run-1",
    tier: "standard",
    statusHistory: [
      { status: "pending", changedAt: iso("2026-07-30T00:00:00.000Z") },
      { status: "active", changedAt: iso("2026-07-30T00:01:00.000Z") },
    ],
    version: 2,
    createdAt: iso("2026-07-30T00:00:00.000Z"),
  };
  const courseRun = {
    id: "run-1",
    courseId: "course-1",
    deliveryModel: "cohort",
    startsAt: iso("2026-07-30T00:00:00.000Z"),
    endsAt: iso("2026-08-30T00:00:00.000Z"),
  };
  const enrollments = {
    enrollment,
    courseRun,
    async findEnrollment(id) { return id === this.enrollment.id ? structuredClone(this.enrollment) : null; },
    async findCourseRun(id) { return id === this.courseRun.id ? structuredClone(this.courseRun) : null; },
  };
  const service = new OneClickAccessService(
    {
      random: new WebCryptoSecureRandomSource(),
      digests: new WebCryptoAccessDigestService(),
      clock,
      ids: {
        invitationId: () => `invitation-${++invitationSequence}`,
        sessionId: () => `session-${++sessionSequence}`,
        eventId: () => `event-${++eventSequence}`,
      },
      invitations,
      sessions,
      enrollments,
      idempotency,
      events: { async publish(event) { events.push(structuredClone(event)); } },
      transactions: new SerialTransactions(),
      capabilities: {
        allows(tier, required) {
          const capabilities = tier === "premium" ? ["course", "downloads", "premium"] : ["course", "downloads"];
          return required.every((value) => capabilities.includes(value));
        },
      },
    },
    {
      sessionLifetimeSeconds: 3600,
      cookieName: "ml_session",
      cookiePath: "/classroom",
      secureCookies: true,
      allowedRedirects: ["/classroom", "/classroom/course"],
    },
  );
  return { service, invitations, sessions, idempotency, events, clock, enrollments };
}

async function issue(harness, key = "issue-key-0001") {
  return harness.service.issueAccessInvitation({
    enrollmentId: "enrollment-1",
    expiresAt: iso("2026-07-31T02:00:00.000Z"),
    idempotencyKey: key,
    requestHash: hash("a"),
  });
}

async function exchange(harness, rawToken, key = "exchange-key-0001", requestHash = hash("b")) {
  return harness.service.exchangeInvitationForSession({
    rawToken,
    destination: "/classroom",
    idempotencyKey: key,
    requestHash,
    clientDigest: hash("c"),
  });
}

test("secure token generation uses at least 32 random bytes and URL-safe encoding", () => {
  const lengths = [];
  const token = generateOpaqueToken({ bytes(length) { lengths.push(length); return new Uint8Array(length).fill(17); } });
  assert.deepEqual(lengths, [32]);
  assert.equal(token.length, 43);
  assert.match(token, /^[A-Za-z0-9_-]+$/u);
  assert.throws(() => generateOpaqueToken({ bytes: (length) => new Uint8Array(length) }, 16), AccessServiceError);
});

test("invitation issuance persists only a digest and returns the raw token once", async () => {
  const harness = createHarness();
  const result = await issue(harness);
  assert.equal(result.outcome, "issued");
  assert.ok(result.rawToken);
  const stored = await harness.invitations.findById(result.invitation.id);
  assert.equal(Object.hasOwn(stored, "rawToken"), false);
  assert.notEqual(stored.tokenDigest, result.rawToken);
  assert.equal(stored.usagePolicy, "reusable");
});

test("invitation issuance is idempotent and never duplicates active invitations", async () => {
  const harness = createHarness();
  const first = await issue(harness);
  const second = await issue(harness);
  assert.equal(first.outcome, "issued");
  assert.equal(second.outcome, "replayed");
  assert.equal(second.invitation.id, first.invitation.id);
  assert.equal(Object.hasOwn(second, "rawToken"), false);
  assert.equal(harness.invitations.rows.size, 1);
});

test("valid invitations remain reusable for scanner-prefetch-safe validation", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const first = await harness.service.validateAccessInvitation(issued.rawToken);
  const second = await harness.service.validateAccessInvitation(issued.rawToken);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal((await harness.invitations.findById(issued.invitation.id)).exchangeCount, 0);
});

test("expired and revoked invitations are rejected", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  harness.clock.value = iso("2026-07-31T03:00:00.000Z");
  assert.deepEqual(await harness.service.validateAccessInvitation(issued.rawToken), { allowed: false, reason: "invitation_expired" });

  const secondHarness = createHarness();
  const secondIssued = await issue(secondHarness);
  await secondHarness.service.revokeAccessInvitation(secondIssued.invitation.id, "support_revocation");
  assert.deepEqual(await secondHarness.service.validateAccessInvitation(secondIssued.rawToken), { allowed: false, reason: "invitation_revoked" });
});

test("inactive entitlement prevents invitation validation and session authorization", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  harness.enrollments.enrollment = {
    ...harness.enrollments.enrollment,
    statusHistory: [...harness.enrollments.enrollment.statusHistory, { status: "revoked", changedAt: iso("2026-07-31T00:10:00.000Z") }],
  };
  assert.deepEqual(await harness.service.validateAccessInvitation(issued.rawToken), { allowed: false, reason: "enrollment_inactive" });
});

test("invitation exchange creates an opaque server-side session and clean redirect", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const result = await exchange(harness, issued.rawToken);
  assert.equal(result.outcome, "created");
  assert.equal(Object.hasOwn(result.session, "rawSessionToken"), false);
  assert.notEqual(result.session.sessionDigest, result.rawSessionToken);
  assert.deepEqual(result.redirect, {
    status: 303,
    location: "/classroom",
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  assert.equal(result.cookie.httpOnly, true);
  assert.equal(result.cookie.secure, true);
  assert.equal(result.cookie.sameSite, "lax");
  assert.equal(result.cookie.path, "/classroom");
});

test("Cloudflare adapters serialize secure cookies and no-store no-referrer redirects", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  const writer = new CloudflareSessionCookieWriter();
  const header = writer.createLearnerSession(exchanged.cookie);
  assert.match(header, /HttpOnly/u);
  assert.match(header, /Secure/u);
  assert.match(header, /SameSite=Lax/u);
  assert.match(header, /Path=\/classroom/u);
  const response = new CloudflareRedirectResponseFactory().create(exchanged.redirect, header);
  assert.equal(response.status, 303);
  assert.equal(response.headers.Location, "/classroom");
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.headers["Referrer-Policy"], "no-referrer");
});

test("open redirects and token-bearing destination URLs are rejected", () => {
  assert.throws(() => createCleanRedirect("https://evil.example", ["/classroom"]), /not allowed/u);
  assert.throws(() => createCleanRedirect("//evil.example", ["/classroom"]), /not allowed/u);
  assert.throws(() => createCleanRedirect("/classroom?token=secret", ["/classroom"]), /not allowed/u);
});

test("session exchange is idempotent and same-client re-exchange leaves one active session", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const first = await exchange(harness, issued.rawToken);
  const replay = await exchange(harness, issued.rawToken);
  assert.equal(replay.outcome, "replayed");
  assert.equal(replay.session.id, first.session.id);

  const replacement = await exchange(harness, issued.rawToken, "exchange-key-0002", hash("d"));
  assert.equal(replacement.outcome, "created");
  const active = await harness.sessions.listActiveByInvitation(issued.invitation.id);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, replacement.session.id);
  assert.equal((await harness.sessions.findById(first.session.id)).status, "revoked");
});

test("concurrent exchanges are serialized and do not create uncontrolled active sessions", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const [first, second] = await Promise.all([
    exchange(harness, issued.rawToken, "exchange-key-1001", hash("e")),
    exchange(harness, issued.rawToken, "exchange-key-1002", hash("f")),
  ]);
  assert.equal(first.outcome, "created");
  assert.equal(second.outcome, "created");
  assert.equal((await harness.sessions.listActiveByInvitation(issued.invitation.id)).length, 1);
});

test("server-side session revocation takes effect without clearing the cookie", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  assert.equal((await harness.service.validateLearnerSession(exchanged.rawSessionToken)).allowed, true);
  await harness.service.revokeLearnerSession(exchanged.session.id, "support_revocation");
  assert.deepEqual(await harness.service.validateLearnerSession(exchanged.rawSessionToken), { allowed: false, reason: "session_revoked" });
});

test("session and invitation expiration are enforced by server-side validation", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  harness.clock.value = iso("2026-07-31T01:01:00.000Z");
  assert.deepEqual(await harness.service.validateLearnerSession(exchanged.rawSessionToken), { allowed: false, reason: "session_expired" });
  assert.equal(await harness.service.expireLearnerSessions(), 1);
  assert.equal((await harness.sessions.findById(exchanged.session.id)).status, "expired");
});

test("entitlement revocation invalidates all sessions and prevents stale reuse", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  assert.equal(await harness.service.revokeEntitlementSessions("enrollment-1", "entitlement_revoked"), 1);
  harness.enrollments.enrollment = {
    ...harness.enrollments.enrollment,
    statusHistory: [...harness.enrollments.enrollment.statusHistory, { status: "revoked", changedAt: iso("2026-07-31T00:10:00.000Z") }],
  };
  assert.equal((await harness.sessions.findById(exchanged.session.id)).status, "revoked");
  assert.deepEqual(await harness.service.validateLearnerSession(exchanged.rawSessionToken), { allowed: false, reason: "session_revoked" });
});

test("invitation regeneration revokes prior invitation and its active sessions", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  const regenerated = await harness.service.regenerateAccessInvitation(
    "enrollment-1",
    iso("2026-07-31T03:00:00.000Z"),
    "regenerate-key-01",
    hash("9"),
  );
  assert.equal(regenerated.outcome, "issued");
  assert.notEqual(regenerated.rawToken, issued.rawToken);
  assert.equal((await harness.invitations.findById(issued.invitation.id)).status, "revoked");
  assert.equal((await harness.sessions.findById(exchanged.session.id)).status, "revoked");
  assert.deepEqual(await harness.service.validateAccessInvitation(issued.rawToken), { allowed: false, reason: "invitation_revoked" });
  assert.equal((await harness.service.validateAccessInvitation(regenerated.rawToken)).allowed, true);
});

test("protected resources require the matching course run, release window, and generic capabilities", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  const allowed = await harness.service.authorizeProtectedResource(exchanged.rawSessionToken, {
    kind: "resource",
    courseRunId: "run-1",
    courseId: "course-1",
    resourceId: "resource-1",
    requiredCapabilities: ["downloads"],
    releasedAt: iso("2026-07-30T00:00:00.000Z"),
  });
  assert.equal(allowed.allowed, true);
  const denied = await harness.service.authorizeProtectedResource(exchanged.rawSessionToken, {
    kind: "resource",
    courseRunId: "run-1",
    courseId: "course-1",
    resourceId: "resource-2",
    requiredCapabilities: ["premium"],
  });
  assert.deepEqual(denied, { allowed: false, reason: "resource_not_entitled" });
});

test("access logs and events can be redacted and never contain raw bearer tokens", async () => {
  const harness = createHarness();
  const issued = await issue(harness);
  const exchanged = await exchange(harness, issued.rawToken);
  const serializedEvents = JSON.stringify(harness.events);
  assert.equal(serializedEvents.includes(issued.rawToken), false);
  assert.equal(serializedEvents.includes(exchanged.rawSessionToken), false);
  assert.equal(redactAccessSecrets(`token=${issued.rawToken}`, [issued.rawToken]), "token=[REDACTED]");
});
