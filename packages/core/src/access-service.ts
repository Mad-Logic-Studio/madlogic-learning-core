import type {
  AccessLinkId,
  CourseRun,
  Enrollment,
  EnrollmentId,
  IdempotencyKey,
  IsoDateTime,
  SessionId,
  TokenDigest,
} from "./index.js";
import {
  AccessServiceError,
  type AccessDenialReason,
  type AccessEventName,
  type AccessInvitation,
  type AccessLifecycleEvent,
  type AccessServiceConfiguration,
  type AccessServiceDependencies,
  type EntitlementAccessStatus,
  type ExchangeInvitationRequest,
  type ExchangeInvitationResult,
  type InvitationValidationResult,
  type IssueAccessInvitationRequest,
  type IssueAccessInvitationResult,
  type LearnerSession,
  type ProtectedResourceDecision,
  type ProtectedResourceDescriptor,
  type RawAccessToken,
  type RawSessionToken,
  type SessionValidationResult,
} from "./access-contracts.js";
import {
  addSeconds,
  courseRunIsAvailable,
  createCleanRedirect,
  currentEnrollmentStatus,
  generateOpaqueToken,
  toEpoch,
  tokenLooksValid,
} from "./access-security.js";

export class OneClickAccessService {
  readonly invitationTokenBytes: number;
  readonly sessionTokenBytes: number;

  constructor(
    readonly dependencies: AccessServiceDependencies,
    readonly configuration: AccessServiceConfiguration,
  ) {
    this.invitationTokenBytes = configuration.invitationTokenBytes ?? 32;
    this.sessionTokenBytes = configuration.sessionTokenBytes ?? 32;
    if (
      this.invitationTokenBytes < 32 ||
      this.sessionTokenBytes < 32 ||
      !Number.isInteger(configuration.sessionLifetimeSeconds) ||
      configuration.sessionLifetimeSeconds <= 0 ||
      !configuration.cookieName ||
      !configuration.cookiePath.startsWith("/") ||
      configuration.allowedRedirects.length === 0
    ) {
      throw new AccessServiceError("Invalid one-click access configuration.", "invalid_configuration");
    }
  }

  async issueAccessInvitation(request: IssueAccessInvitationRequest): Promise<IssueAccessInvitationResult> {
    return this.dependencies.transactions.transaction(async () => {
      const now = this.dependencies.clock.now();
      const claim = await this.dependencies.idempotency.claim(
        "access.invitation.issue",
        request.idempotencyKey,
        request.requestHash,
        now,
      );
      if (claim.outcome === "conflict") throw new AccessServiceError("Idempotency conflict.", "idempotency_conflict");
      if (claim.outcome === "replay") {
        const existing = await this.dependencies.invitations.findById(claim.responseReference as AccessLinkId);
        if (existing === null) {
          throw new AccessServiceError("Idempotency replay target is missing.", "idempotency_replay_missing");
        }
        return { outcome: "replayed", invitation: existing };
      }

      const access = await this.loadEnrollmentAccess(request.enrollmentId, now);
      if (!access.allowed) {
        await this.publishDenied(request.enrollmentId, access.reason, now);
        throw new AccessServiceError("Enrollment is not eligible for an invitation.", "access_denied");
      }
      if (toEpoch(request.expiresAt) <= toEpoch(now)) {
        throw new AccessServiceError("Invitation expiration must be in the future.", "access_denied");
      }
      const active = await this.dependencies.invitations.listActiveByEnrollment(request.enrollmentId);
      if (active.some((invitation) => toEpoch(invitation.expiresAt) > toEpoch(now))) {
        throw new AccessServiceError("An active invitation already exists.", "active_invitation_exists");
      }

      const created = await this.createInvitation(access.enrollment, request.expiresAt, now);
      await this.dependencies.idempotency.complete(
        "access.invitation.issue",
        request.idempotencyKey,
        created.invitation.id,
        now,
      );
      await this.publish("access.invitation_issued", now, {
        enrollmentId: created.invitation.enrollmentId,
        learnerId: created.invitation.learnerId,
        invitationId: created.invitation.id,
        payload: { version: created.invitation.version, usage_policy: "reusable" },
      });
      return { outcome: "issued", invitation: created.invitation, rawToken: created.rawToken };
    });
  }

  async validateAccessInvitation(rawToken: RawAccessToken): Promise<InvitationValidationResult> {
    const now = this.dependencies.clock.now();
    if (!tokenLooksValid(rawToken)) return { allowed: false, reason: "invalid_token" };
    const digest = await this.dependencies.digests.digest(rawToken);
    const invitation = await this.dependencies.invitations.findByDigest(digest);
    if (invitation === null || !(await this.dependencies.digests.matches(rawToken, invitation.tokenDigest))) {
      return { allowed: false, reason: "invitation_unavailable" };
    }
    if (invitation.status === "revoked") return { allowed: false, reason: "invitation_revoked" };
    if (invitation.status === "consumed") return { allowed: false, reason: "invitation_unavailable" };
    if (invitation.status === "expired" || toEpoch(now) >= toEpoch(invitation.expiresAt)) {
      return { allowed: false, reason: "invitation_expired" };
    }
    const access = await this.loadEnrollmentAccess(invitation.enrollmentId, now);
    if (!access.allowed) return access;
    return { allowed: true, invitation, enrollment: access.enrollment, courseRun: access.courseRun };
  }

  async exchangeInvitationForSession(request: ExchangeInvitationRequest): Promise<ExchangeInvitationResult> {
    const redirect = createCleanRedirect(request.destination, this.configuration.allowedRedirects);
    return this.dependencies.transactions.transaction(async () => {
      const now = this.dependencies.clock.now();
      const claim = await this.dependencies.idempotency.claim(
        "access.invitation.exchange",
        request.idempotencyKey,
        request.requestHash,
        now,
      );
      if (claim.outcome === "conflict") throw new AccessServiceError("Idempotency conflict.", "idempotency_conflict");
      if (claim.outcome === "replay") {
        const existing = await this.dependencies.sessions.findById(claim.responseReference as SessionId);
        if (existing === null) {
          throw new AccessServiceError("Idempotency replay target is missing.", "idempotency_replay_missing");
        }
        return { outcome: "replayed", session: existing, redirect };
      }

      const validation = await this.validateAccessInvitation(request.rawToken);
      if (!validation.allowed) {
        await this.publishDenied(undefined, validation.reason, now);
        throw new AccessServiceError("Invitation exchange denied.", "access_denied");
      }

      const existingSessions = await this.dependencies.sessions.listActiveByInvitation(validation.invitation.id);
      for (const existingSession of existingSessions) {
        await this.revokeSessionRecord(existingSession, "superseded_exchange", now);
      }

      const rawSessionToken = generateOpaqueToken(this.dependencies.random, this.sessionTokenBytes) as RawSessionToken;
      const sessionDigest = await this.dependencies.digests.digest(rawSessionToken);
      const session: LearnerSession = {
        id: this.dependencies.ids.sessionId(),
        enrollmentId: validation.enrollment.id,
        learnerId: validation.enrollment.learnerId,
        invitationId: validation.invitation.id,
        sessionDigest,
        status: "active",
        issuedAt: now,
        expiresAt: addSeconds(now, this.configuration.sessionLifetimeSeconds),
        lastSeenAt: now,
        rotation: 1,
        version: 1,
        ...(request.clientDigest === undefined ? {} : { clientDigest: request.clientDigest }),
      };
      await this.dependencies.sessions.save(session, null);
      const touchedInvitation: AccessInvitation = {
        ...validation.invitation,
        lastExchangedAt: now,
        exchangeCount: validation.invitation.exchangeCount + 1,
        version: validation.invitation.version + 1,
      };
      await this.dependencies.invitations.save(touchedInvitation, validation.invitation.version);
      await this.dependencies.idempotency.complete(
        "access.invitation.exchange",
        request.idempotencyKey,
        session.id,
        now,
      );
      await this.publish("access.session_started", now, {
        enrollmentId: session.enrollmentId,
        learnerId: session.learnerId,
        invitationId: session.invitationId,
        sessionId: session.id,
        payload: { rotation: session.rotation, version: session.version },
      });
      return {
        outcome: "created",
        session,
        rawSessionToken,
        cookie: {
          name: this.configuration.cookieName,
          value: rawSessionToken,
          httpOnly: true,
          secure: this.configuration.secureCookies,
          sameSite: "lax",
          path: this.configuration.cookiePath,
          maxAgeSeconds: this.configuration.sessionLifetimeSeconds,
        },
        redirect,
      };
    });
  }

  async validateLearnerSession(rawToken: RawSessionToken): Promise<SessionValidationResult> {
    throw new Error("Access service extension is not loaded.");
  }

  async refreshLearnerSession(
    rawToken: RawSessionToken,
    idempotencyKey: IdempotencyKey,
    requestHash: TokenDigest,
  ): Promise<ExchangeInvitationResult> {
    throw new Error("Access service extension is not loaded.");
  }

  async revokeAccessInvitation(id: AccessLinkId, reason: string): Promise<AccessInvitation> {
    throw new Error("Access service extension is not loaded.");
  }

  async regenerateAccessInvitation(
    enrollmentId: EnrollmentId,
    expiresAt: IsoDateTime,
    idempotencyKey: IdempotencyKey,
    requestHash: TokenDigest,
  ): Promise<IssueAccessInvitationResult> {
    throw new Error("Access service extension is not loaded.");
  }

  async revokeLearnerSession(id: SessionId, reason: string): Promise<LearnerSession> {
    throw new Error("Access service extension is not loaded.");
  }

  async revokeEntitlementSessions(enrollmentId: EnrollmentId, reason: string): Promise<number> {
    throw new Error("Access service extension is not loaded.");
  }

  async expireAccessInvitations(): Promise<number> {
    throw new Error("Access service extension is not loaded.");
  }

  async expireLearnerSessions(): Promise<number> {
    throw new Error("Access service extension is not loaded.");
  }

  async authorizeProtectedResource(
    rawSessionToken: RawSessionToken,
    resource: ProtectedResourceDescriptor,
  ): Promise<ProtectedResourceDecision> {
    throw new Error("Access service extension is not loaded.");
  }

  async listActiveInvitations(enrollmentId: EnrollmentId): Promise<readonly AccessInvitation[]> {
    throw new Error("Access service extension is not loaded.");
  }

  async listActiveSessions(enrollmentId: EnrollmentId): Promise<readonly LearnerSession[]> {
    throw new Error("Access service extension is not loaded.");
  }

  async inspectEntitlementAccessStatus(enrollmentId: EnrollmentId): Promise<EntitlementAccessStatus> {
    throw new Error("Access service extension is not loaded.");
  }

  async createInvitation(
    enrollment: Enrollment,
    expiresAt: IsoDateTime,
    now: IsoDateTime,
    regeneratedFromId?: AccessLinkId,
  ): Promise<{ readonly invitation: AccessInvitation; readonly rawToken: RawAccessToken }> {
    const rawToken = generateOpaqueToken(this.dependencies.random, this.invitationTokenBytes) as RawAccessToken;
    const invitation: AccessInvitation = {
      id: this.dependencies.ids.invitationId(),
      enrollmentId: enrollment.id,
      learnerId: enrollment.learnerId,
      tokenDigest: await this.dependencies.digests.digest(rawToken),
      status: "active",
      usagePolicy: "reusable",
      expiresAt,
      version: 1,
      createdAt: now,
      exchangeCount: 0,
      ...(regeneratedFromId === undefined ? {} : { regeneratedFromId }),
    };
    await this.dependencies.invitations.save(invitation, null);
    return { invitation, rawToken };
  }

  async loadEnrollmentAccess(
    enrollmentId: EnrollmentId,
    now: IsoDateTime,
  ): Promise<
    | { readonly allowed: true; readonly enrollment: Enrollment; readonly courseRun: CourseRun }
    | { readonly allowed: false; readonly reason: AccessDenialReason }
  > {
    const enrollment = await this.dependencies.enrollments.findEnrollment(enrollmentId);
    if (enrollment === null || currentEnrollmentStatus(enrollment) !== "active") {
      return { allowed: false, reason: "enrollment_inactive" };
    }
    const courseRun = await this.dependencies.enrollments.findCourseRun(enrollment.courseRunId);
    if (courseRun === null || !courseRunIsAvailable(courseRun, now)) {
      return { allowed: false, reason: "course_run_unavailable" };
    }
    return { allowed: true, enrollment, courseRun };
  }

  async revokeSessionRecord(
    session: LearnerSession,
    reason: string,
    now: IsoDateTime,
  ): Promise<LearnerSession> {
    if (session.status !== "active") return session;
    const revoked: LearnerSession = {
      ...session,
      status: "revoked",
      revokedAt: now,
      revocationReason: reason,
      version: session.version + 1,
    };
    await this.dependencies.sessions.save(revoked, session.version);
    await this.publish("access.session_revoked", now, {
      enrollmentId: revoked.enrollmentId,
      learnerId: revoked.learnerId,
      invitationId: revoked.invitationId,
      sessionId: revoked.id,
      payload: { reason },
    });
    return revoked;
  }

  async publish(
    name: AccessEventName,
    occurredAt: IsoDateTime,
    references: Omit<AccessLifecycleEvent, "id" | "name" | "occurredAt">,
  ): Promise<void> {
    await this.dependencies.events.publish({
      id: this.dependencies.ids.eventId(),
      name,
      occurredAt,
      ...references,
    });
  }

  async publishDenied(
    enrollmentId: EnrollmentId | undefined,
    reason: AccessDenialReason,
    occurredAt: IsoDateTime,
  ): Promise<void> {
    await this.publish("access.denied", occurredAt, {
      ...(enrollmentId === undefined ? {} : { enrollmentId }),
      payload: { reason },
    });
  }
}
