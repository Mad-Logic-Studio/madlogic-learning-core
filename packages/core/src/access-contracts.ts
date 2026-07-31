import type {
  AccessLinkId,
  CourseId,
  CourseRun,
  CourseRunId,
  Enrollment,
  EnrollmentId,
  IdempotencyKey,
  IsoDateTime,
  LearnerId,
  LearningEventId,
  LessonId,
  SessionId,
  TokenDigest,
} from "./index.js";

export type RawAccessToken = string & { readonly __opaque: "RawAccessToken" };
export type RawSessionToken = string & { readonly __opaque: "RawSessionToken" };
export type AccessInvitationStatus = "active" | "revoked" | "expired" | "consumed";
export type LearnerSessionStatus = "active" | "revoked" | "expired";

export interface AccessInvitation {
  readonly id: AccessLinkId;
  readonly enrollmentId: EnrollmentId;
  readonly learnerId: LearnerId;
  readonly tokenDigest: TokenDigest;
  readonly status: AccessInvitationStatus;
  readonly usagePolicy: "reusable" | "single_use";
  readonly expiresAt: IsoDateTime;
  readonly version: number;
  readonly createdAt: IsoDateTime;
  readonly lastExchangedAt?: IsoDateTime;
  readonly exchangeCount: number;
  readonly revokedAt?: IsoDateTime;
  readonly consumedAt?: IsoDateTime;
  readonly revocationReason?: string;
  readonly regeneratedFromId?: AccessLinkId;
  readonly replacedById?: AccessLinkId;
}

export interface LearnerSession {
  readonly id: SessionId;
  readonly enrollmentId: EnrollmentId;
  readonly learnerId: LearnerId;
  readonly invitationId: AccessLinkId;
  readonly sessionDigest: TokenDigest;
  readonly status: LearnerSessionStatus;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly lastSeenAt: IsoDateTime;
  readonly rotation: number;
  readonly version: number;
  readonly revokedAt?: IsoDateTime;
  readonly revocationReason?: string;
  readonly clientDigest?: TokenDigest;
}

export type AccessEventName =
  | "access.invitation_issued"
  | "access.invitation_revoked"
  | "access.invitation_regenerated"
  | "access.invitation_expired"
  | "access.session_started"
  | "access.session_refreshed"
  | "access.session_revoked"
  | "access.session_expired"
  | "access.denied";

export interface AccessLifecycleEvent {
  readonly id: LearningEventId;
  readonly name: AccessEventName;
  readonly occurredAt: IsoDateTime;
  readonly enrollmentId?: EnrollmentId;
  readonly learnerId?: LearnerId;
  readonly invitationId?: AccessLinkId;
  readonly sessionId?: SessionId;
  readonly payload: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SecureRandomSource {
  bytes(length: number): Uint8Array;
}

export interface AccessDigestService {
  digest(value: string): Promise<TokenDigest>;
  matches(candidate: string, digest: TokenDigest): Promise<boolean>;
}

export interface AccessClock {
  now(): IsoDateTime;
}

export interface AccessIdentifierFactory {
  invitationId(): AccessLinkId;
  sessionId(): SessionId;
  eventId(): LearningEventId;
}

export interface AccessInvitationStore {
  findById(id: AccessLinkId): Promise<AccessInvitation | null>;
  findByDigest(digest: TokenDigest): Promise<AccessInvitation | null>;
  listActiveByEnrollment(enrollmentId: EnrollmentId): Promise<readonly AccessInvitation[]>;
  listExpiring(atOrBefore: IsoDateTime): Promise<readonly AccessInvitation[]>;
  save(invitation: AccessInvitation, expectedVersion: number | null): Promise<void>;
}

export interface LearnerSessionStore {
  findById(id: SessionId): Promise<LearnerSession | null>;
  findByDigest(digest: TokenDigest): Promise<LearnerSession | null>;
  listActiveByEnrollment(enrollmentId: EnrollmentId): Promise<readonly LearnerSession[]>;
  listActiveByInvitation(invitationId: AccessLinkId): Promise<readonly LearnerSession[]>;
  listExpiring(atOrBefore: IsoDateTime): Promise<readonly LearnerSession[]>;
  save(session: LearnerSession, expectedVersion: number | null): Promise<void>;
}

export interface EnrollmentAccessStore {
  findEnrollment(id: EnrollmentId): Promise<Enrollment | null>;
  findCourseRun(id: CourseRunId): Promise<CourseRun | null>;
}

export type AccessIdempotencyClaim =
  | { readonly outcome: "claimed" }
  | { readonly outcome: "replay"; readonly responseReference: string }
  | { readonly outcome: "conflict" };

export interface AccessIdempotencyStore {
  claim(
    operation: string,
    key: IdempotencyKey,
    requestHash: TokenDigest,
    now: IsoDateTime,
  ): Promise<AccessIdempotencyClaim>;
  complete(
    operation: string,
    key: IdempotencyKey,
    responseReference: string,
    now: IsoDateTime,
  ): Promise<void>;
}

export interface AccessEventPublisher {
  publish(event: AccessLifecycleEvent): Promise<void>;
}

export interface AccessTransactionBoundary {
  transaction<TResult>(operation: () => Promise<TResult>): Promise<TResult>;
}

export interface CapabilityPolicy {
  allows(tier: string, requiredCapabilities: readonly string[]): boolean;
}

export interface AccessServiceDependencies {
  readonly random: SecureRandomSource;
  readonly digests: AccessDigestService;
  readonly clock: AccessClock;
  readonly ids: AccessIdentifierFactory;
  readonly invitations: AccessInvitationStore;
  readonly sessions: LearnerSessionStore;
  readonly enrollments: EnrollmentAccessStore;
  readonly idempotency: AccessIdempotencyStore;
  readonly events: AccessEventPublisher;
  readonly transactions: AccessTransactionBoundary;
  readonly capabilities: CapabilityPolicy;
}

export interface AccessServiceConfiguration {
  readonly invitationTokenBytes?: number;
  readonly sessionTokenBytes?: number;
  readonly sessionLifetimeSeconds: number;
  readonly cookieName: string;
  readonly cookiePath: string;
  readonly secureCookies: boolean;
  readonly allowedRedirects: readonly string[];
}

export type AccessServiceErrorCode =
  | "invalid_configuration"
  | "invalid_token"
  | "invalid_redirect"
  | "idempotency_conflict"
  | "idempotency_replay_missing"
  | "active_invitation_exists"
  | "access_denied"
  | "concurrency_conflict";

export class AccessServiceError extends Error {
  constructor(
    message: string,
    readonly code: AccessServiceErrorCode,
  ) {
    super(message);
    this.name = "AccessServiceError";
  }
}

export interface IssueAccessInvitationRequest {
  readonly enrollmentId: EnrollmentId;
  readonly expiresAt: IsoDateTime;
  readonly idempotencyKey: IdempotencyKey;
  readonly requestHash: TokenDigest;
}

export type IssueAccessInvitationResult =
  | {
      readonly outcome: "issued";
      readonly invitation: AccessInvitation;
      readonly rawToken: RawAccessToken;
    }
  | {
      readonly outcome: "replayed";
      readonly invitation: AccessInvitation;
    };

export type AccessDenialReason =
  | "invalid_token"
  | "invitation_unavailable"
  | "invitation_revoked"
  | "invitation_expired"
  | "session_unavailable"
  | "session_revoked"
  | "session_expired"
  | "enrollment_inactive"
  | "course_run_unavailable"
  | "resource_not_entitled"
  | "resource_unreleased";

export type InvitationValidationResult =
  | {
      readonly allowed: true;
      readonly invitation: AccessInvitation;
      readonly enrollment: Enrollment;
      readonly courseRun: CourseRun;
    }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

export interface ExchangeInvitationRequest {
  readonly rawToken: RawAccessToken;
  readonly destination: string;
  readonly idempotencyKey: IdempotencyKey;
  readonly requestHash: TokenDigest;
  readonly clientDigest?: TokenDigest;
}

export interface SessionCookieDirective {
  readonly name: string;
  readonly value: RawSessionToken;
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: string;
  readonly maxAgeSeconds: number;
}

export interface CleanRedirectDirective {
  readonly status: 303;
  readonly location: string;
  readonly headers: Readonly<{
    "Cache-Control": "no-store";
    "Referrer-Policy": "no-referrer";
  }>;
}

export type ExchangeInvitationResult =
  | {
      readonly outcome: "created";
      readonly session: LearnerSession;
      readonly rawSessionToken: RawSessionToken;
      readonly cookie: SessionCookieDirective;
      readonly redirect: CleanRedirectDirective;
    }
  | {
      readonly outcome: "replayed";
      readonly session: LearnerSession;
      readonly redirect: CleanRedirectDirective;
    };

export type SessionValidationResult =
  | {
      readonly allowed: true;
      readonly session: LearnerSession;
      readonly invitation: AccessInvitation;
      readonly enrollment: Enrollment;
      readonly courseRun: CourseRun;
    }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

export interface ProtectedResourceDescriptor {
  readonly kind: "course" | "lesson" | "resource";
  readonly courseRunId: CourseRunId;
  readonly courseId: CourseId;
  readonly lessonId?: LessonId;
  readonly resourceId?: string;
  readonly requiredCapabilities: readonly string[];
  readonly releasedAt?: IsoDateTime;
  readonly unavailableAfter?: IsoDateTime;
}

export type ProtectedResourceDecision =
  | { readonly allowed: true; readonly session: LearnerSession; readonly enrollment: Enrollment }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

export interface EnrollmentGrantCommand {
  readonly learnerId: LearnerId;
  readonly courseRunId: CourseRunId;
  readonly tier: string;
  readonly idempotencyKey: IdempotencyKey;
  readonly requestHash: TokenDigest;
}

export interface EnrollmentGrantService {
  grantOrConfirmEnrollment(command: EnrollmentGrantCommand): Promise<Enrollment>;
}

export interface EntitlementAccessStatus {
  readonly enrollment: Enrollment | null;
  readonly activeInvitations: readonly AccessInvitation[];
  readonly activeSessions: readonly LearnerSession[];
}
