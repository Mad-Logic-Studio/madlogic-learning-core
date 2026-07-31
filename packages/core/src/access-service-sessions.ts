import type { EnrollmentId, IdempotencyKey, SessionId, TokenDigest } from "./index.js";
import {
  AccessServiceError,
  type EntitlementAccessStatus,
  type ExchangeInvitationResult,
  type LearnerSession,
  type ProtectedResourceDecision,
  type ProtectedResourceDescriptor,
  type RawSessionToken,
  type SessionValidationResult,
} from "./access-contracts.js";
import {
  addSeconds,
  createCleanRedirect,
  generateOpaqueToken,
  toEpoch,
  tokenLooksValid,
} from "./access-security.js";
import { OneClickAccessService } from "./access-service.js";

OneClickAccessService.prototype.validateLearnerSession = async function (
  this: OneClickAccessService,
  rawToken: RawSessionToken,
): Promise<SessionValidationResult> {
  const now = this.dependencies.clock.now();
  if (!tokenLooksValid(rawToken)) return { allowed: false, reason: "invalid_token" };
  const digest = await this.dependencies.digests.digest(rawToken);
  const session = await this.dependencies.sessions.findByDigest(digest);
  if (session === null || !(await this.dependencies.digests.matches(rawToken, session.sessionDigest))) {
    return { allowed: false, reason: "session_unavailable" };
  }
  if (session.status === "revoked") return { allowed: false, reason: "session_revoked" };
  if (session.status === "expired" || toEpoch(now) >= toEpoch(session.expiresAt)) {
    return { allowed: false, reason: "session_expired" };
  }
  const invitation = await this.dependencies.invitations.findById(session.invitationId);
  if (invitation === null) return { allowed: false, reason: "invitation_unavailable" };
  if (invitation.status === "revoked") return { allowed: false, reason: "invitation_revoked" };
  if (invitation.status === "consumed") return { allowed: false, reason: "invitation_unavailable" };
  if (invitation.status === "expired" || toEpoch(now) >= toEpoch(invitation.expiresAt)) {
    return { allowed: false, reason: "invitation_expired" };
  }
  const access = await this.loadEnrollmentAccess(session.enrollmentId, now);
  if (!access.allowed) return access;
  return { allowed: true, session, invitation, enrollment: access.enrollment, courseRun: access.courseRun };
};

OneClickAccessService.prototype.refreshLearnerSession = async function (
  this: OneClickAccessService,
  rawToken: RawSessionToken,
  idempotencyKey: IdempotencyKey,
  requestHash: TokenDigest,
): Promise<ExchangeInvitationResult> {
  const validation = await this.validateLearnerSession(rawToken);
  if (!validation.allowed) throw new AccessServiceError("Session refresh denied.", "access_denied");
  const redirect = createCleanRedirect(
    this.configuration.allowedRedirects[0] ?? "",
    this.configuration.allowedRedirects,
  );
  return this.dependencies.transactions.transaction(async () => {
    const now = this.dependencies.clock.now();
    const claim = await this.dependencies.idempotency.claim(
      "access.session.refresh",
      idempotencyKey,
      requestHash,
      now,
    );
    if (claim.outcome === "conflict") throw new AccessServiceError("Idempotency conflict.", "idempotency_conflict");
    if (claim.outcome === "replay") {
      const existing = await this.dependencies.sessions.findById(claim.responseReference as SessionId);
      if (existing === null) throw new AccessServiceError("Replay target is missing.", "idempotency_replay_missing");
      return { outcome: "replayed", session: existing, redirect };
    }
    await this.revokeSessionRecord(validation.session, "rotated", now);
    const newRawToken = generateOpaqueToken(this.dependencies.random, this.sessionTokenBytes) as RawSessionToken;
    const normalizedSession: LearnerSession = {
      id: this.dependencies.ids.sessionId(),
      enrollmentId: validation.session.enrollmentId,
      learnerId: validation.session.learnerId,
      invitationId: validation.session.invitationId,
      sessionDigest: await this.dependencies.digests.digest(newRawToken),
      status: "active",
      issuedAt: now,
      expiresAt: addSeconds(now, this.configuration.sessionLifetimeSeconds),
      lastSeenAt: now,
      rotation: validation.session.rotation + 1,
      version: 1,
      ...(validation.session.clientDigest === undefined
        ? {}
        : { clientDigest: validation.session.clientDigest }),
    };
    await this.dependencies.sessions.save(normalizedSession, null);
    await this.dependencies.idempotency.complete("access.session.refresh", idempotencyKey, normalizedSession.id, now);
    await this.publish("access.session_refreshed", now, {
      enrollmentId: normalizedSession.enrollmentId,
      learnerId: normalizedSession.learnerId,
      invitationId: normalizedSession.invitationId,
      sessionId: normalizedSession.id,
      payload: { rotation: normalizedSession.rotation },
    });
    return {
      outcome: "created",
      session: normalizedSession,
      rawSessionToken: newRawToken,
      cookie: {
        name: this.configuration.cookieName,
        value: newRawToken,
        httpOnly: true,
        secure: this.configuration.secureCookies,
        sameSite: "lax",
        path: this.configuration.cookiePath,
        maxAgeSeconds: this.configuration.sessionLifetimeSeconds,
      },
      redirect,
    };
  });
};

OneClickAccessService.prototype.revokeLearnerSession = async function (
  this: OneClickAccessService,
  id: SessionId,
  reason: string,
): Promise<LearnerSession> {
  return this.dependencies.transactions.transaction(async () => {
    const session = await this.dependencies.sessions.findById(id);
    if (session === null) throw new AccessServiceError("Session is unavailable.", "access_denied");
    if (session.status !== "active") return session;
    return this.revokeSessionRecord(session, reason, this.dependencies.clock.now());
  });
};

OneClickAccessService.prototype.revokeEntitlementSessions = async function (
  this: OneClickAccessService,
  enrollmentId: EnrollmentId,
  reason: string,
): Promise<number> {
  return this.dependencies.transactions.transaction(async () => {
    const now = this.dependencies.clock.now();
    const sessions = await this.dependencies.sessions.listActiveByEnrollment(enrollmentId);
    for (const session of sessions) await this.revokeSessionRecord(session, reason, now);
    return sessions.length;
  });
};

OneClickAccessService.prototype.expireLearnerSessions = async function (
  this: OneClickAccessService,
): Promise<number> {
  return this.dependencies.transactions.transaction(async () => {
    const now = this.dependencies.clock.now();
    const expiring = await this.dependencies.sessions.listExpiring(now);
    let count = 0;
    for (const session of expiring) {
      if (session.status !== "active") continue;
      const expired: LearnerSession = {
        ...session,
        status: "expired",
        version: session.version + 1,
      };
      await this.dependencies.sessions.save(expired, session.version);
      await this.publish("access.session_expired", now, {
        enrollmentId: expired.enrollmentId,
        learnerId: expired.learnerId,
        invitationId: expired.invitationId,
        sessionId: expired.id,
        payload: {},
      });
      count += 1;
    }
    return count;
  });
};

OneClickAccessService.prototype.authorizeProtectedResource = async function (
  this: OneClickAccessService,
  rawSessionToken: RawSessionToken,
  resource: ProtectedResourceDescriptor,
): Promise<ProtectedResourceDecision> {
  const validation = await this.validateLearnerSession(rawSessionToken);
  if (!validation.allowed) return validation;
  const now = this.dependencies.clock.now();
  if (validation.courseRun.id !== resource.courseRunId || validation.courseRun.courseId !== resource.courseId) {
    return { allowed: false, reason: "resource_not_entitled" };
  }
  if (
    (resource.releasedAt !== undefined && toEpoch(now) < toEpoch(resource.releasedAt)) ||
    (resource.unavailableAfter !== undefined && toEpoch(now) >= toEpoch(resource.unavailableAfter))
  ) {
    return { allowed: false, reason: "resource_unreleased" };
  }
  if (!this.dependencies.capabilities.allows(validation.enrollment.tier, resource.requiredCapabilities)) {
    return { allowed: false, reason: "resource_not_entitled" };
  }
  return { allowed: true, session: validation.session, enrollment: validation.enrollment };
};

OneClickAccessService.prototype.listActiveSessions = async function (
  this: OneClickAccessService,
  enrollmentId: EnrollmentId,
): Promise<readonly LearnerSession[]> {
  return this.dependencies.sessions.listActiveByEnrollment(enrollmentId);
};

OneClickAccessService.prototype.inspectEntitlementAccessStatus = async function (
  this: OneClickAccessService,
  enrollmentId: EnrollmentId,
): Promise<EntitlementAccessStatus> {
  return {
    enrollment: await this.dependencies.enrollments.findEnrollment(enrollmentId),
    activeInvitations: await this.dependencies.invitations.listActiveByEnrollment(enrollmentId),
    activeSessions: await this.dependencies.sessions.listActiveByEnrollment(enrollmentId),
  };
};
