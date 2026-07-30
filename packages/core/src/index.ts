export type OpaqueId<TName extends string> = string & { readonly __opaque: TName };

export type LearnerId = OpaqueId<"LearnerId">;
export type CourseId = OpaqueId<"CourseId">;
export type CourseRunId = OpaqueId<"CourseRunId">;
export type LessonId = OpaqueId<"LessonId">;
export type EnrollmentId = OpaqueId<"EnrollmentId">;
export type AccessLinkId = OpaqueId<"AccessLinkId">;
export type LearningEventId = OpaqueId<"LearningEventId">;
export type SessionId = OpaqueId<"SessionId">;
export type TokenDigest = OpaqueId<"TokenDigest">;
export type AccessTokenCandidate = OpaqueId<"AccessTokenCandidate">;
export type IdempotencyKey = OpaqueId<"IdempotencyKey">;

export type IsoDateTime = string & { readonly __opaque: "IsoDateTime" };
export type DeliveryModel = "live" | "evergreen" | "cohort";
export type EnrollmentStatus = "pending" | "active" | "paused" | "completed" | "revoked" | "expired";
export type AccessLinkStatus = "active" | "revoked" | "consumed" | "expired";
export type AccessLinkUsagePolicy = "single_use" | "reusable";
export type ProgressState = "not_started" | "in_progress" | "completed";

export interface Learner {
  readonly id: LearnerId;
  readonly displayName?: string;
  readonly externalReferences?: Readonly<Record<string, string>>;
  readonly createdAt: IsoDateTime;
}

export interface Course {
  readonly id: CourseId;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly lessonIds: readonly LessonId[];
  readonly createdAt: IsoDateTime;
}

export interface CourseRun {
  readonly id: CourseRunId;
  readonly courseId: CourseId;
  readonly deliveryModel: DeliveryModel;
  readonly startsAt?: IsoDateTime;
  readonly endsAt?: IsoDateTime;
  readonly cohortKey?: string;
}

export interface Lesson {
  readonly id: LessonId;
  readonly courseId: CourseId;
  readonly slug: string;
  readonly title: string;
  readonly position: number;
}

export interface EnrollmentStatusRecord {
  readonly status: EnrollmentStatus;
  readonly changedAt: IsoDateTime;
  readonly reason?: string;
}

export interface Enrollment {
  readonly id: EnrollmentId;
  readonly learnerId: LearnerId;
  readonly courseRunId: CourseRunId;
  readonly tier: string;
  readonly statusHistory: readonly EnrollmentStatusRecord[];
  readonly version: number;
  readonly createdAt: IsoDateTime;
}

export interface AccessLink {
  readonly id: AccessLinkId;
  readonly enrollmentId: EnrollmentId;
  readonly tokenDigest: TokenDigest;
  readonly status: AccessLinkStatus;
  readonly usagePolicy: AccessLinkUsagePolicy;
  readonly expiresAt: IsoDateTime;
  readonly version: number;
  readonly createdAt: IsoDateTime;
  readonly consumedAt?: IsoDateTime;
  readonly revokedAt?: IsoDateTime;
}

export interface LessonProgress {
  readonly enrollmentId: EnrollmentId;
  readonly lessonId: LessonId;
  readonly state: ProgressState;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export type LearningEventName =
  | "enrollment.created"
  | "enrollment.status_changed"
  | "access_link.created"
  | "access_link.consumed"
  | "access_link.revoked"
  | "access_link.expired"
  | "lesson.started"
  | "lesson.completed";

export interface LearningEvent<TPayload = Readonly<Record<string, unknown>>> {
  readonly id: LearningEventId;
  readonly name: LearningEventName;
  readonly occurredAt: IsoDateTime;
  readonly learnerId?: LearnerId;
  readonly enrollmentId?: EnrollmentId;
  readonly payload: TPayload;
}

export interface DomainValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface DomainValidator<TValue> {
  validate(value: TValue): readonly DomainValidationIssue[];
}

export class LearningCoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "LearningCoreError";
  }
}

export class InvalidDomainTransitionError extends LearningCoreError {
  constructor(aggregate: string, from: string, to: string) {
    super(`Invalid ${aggregate} transition from ${from} to ${to}.`, "invalid_transition");
    this.name = "InvalidDomainTransitionError";
  }
}

export class DomainInvariantError extends LearningCoreError {
  constructor(message: string) {
    super(message, "domain_invariant_failed");
    this.name = "DomainInvariantError";
  }
}

export interface LearningEventPublisher {
  publish(event: LearningEvent): Promise<void>;
}

const enrollmentTransitions: Readonly<Record<EnrollmentStatus, readonly EnrollmentStatus[]>> = Object.freeze({
  pending: ["active", "revoked", "expired"],
  active: ["paused", "completed", "revoked", "expired"],
  paused: ["active", "completed", "revoked", "expired"],
  completed: [],
  revoked: [],
  expired: [],
});

const accessLinkTransitions: Readonly<Record<AccessLinkStatus, readonly AccessLinkStatus[]>> = Object.freeze({
  active: ["consumed", "revoked", "expired"],
  consumed: [],
  revoked: [],
  expired: [],
});

function toEpoch(value: IsoDateTime): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new DomainInvariantError(`Invalid ISO date-time: ${value}`);
  return epoch;
}

export function currentEnrollmentStatus(enrollment: Enrollment): EnrollmentStatus {
  const latest = enrollment.statusHistory.at(-1);
  if (!latest) throw new DomainInvariantError("Enrollment status history must not be empty.");
  return latest.status;
}

export function isEnrollmentActive(enrollment: Enrollment): boolean {
  return currentEnrollmentStatus(enrollment) === "active";
}

export function canTransitionEnrollmentStatus(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return enrollmentTransitions[from].includes(to);
}

export function validateEnrollment(enrollment: Enrollment): readonly DomainValidationIssue[] {
  const issues: DomainValidationIssue[] = [];
  if (enrollment.version < 1 || !Number.isInteger(enrollment.version)) {
    issues.push({ code: "invalid_version", path: "version", message: "Enrollment version must be a positive integer." });
  }
  if (enrollment.statusHistory.length === 0) {
    issues.push({ code: "missing_status_history", path: "statusHistory", message: "Enrollment status history is required." });
    return issues;
  }
  if (enrollment.statusHistory[0]?.status !== "pending") {
    issues.push({ code: "invalid_initial_status", path: "statusHistory[0]", message: "Enrollment history must begin with pending." });
  }
  for (let index = 1; index < enrollment.statusHistory.length; index += 1) {
    const previous = enrollment.statusHistory[index - 1];
    const current = enrollment.statusHistory[index];
    if (!previous || !current) continue;
    if (toEpoch(current.changedAt) < toEpoch(previous.changedAt)) {
      issues.push({ code: "non_monotonic_history", path: `statusHistory[${index}]`, message: "Status history must be chronological." });
    }
    if (!canTransitionEnrollmentStatus(previous.status, current.status)) {
      issues.push({ code: "invalid_transition", path: `statusHistory[${index}]`, message: `Invalid transition from ${previous.status} to ${current.status}.` });
    }
  }
  return issues;
}

export function transitionEnrollment(
  enrollment: Enrollment,
  targetStatus: EnrollmentStatus,
  changedAt: IsoDateTime,
  reason?: string,
): Enrollment {
  const issues = validateEnrollment(enrollment);
  if (issues.length > 0) throw new DomainInvariantError(issues[0]?.message ?? "Enrollment is invalid.");
  const from = currentEnrollmentStatus(enrollment);
  if (!canTransitionEnrollmentStatus(from, targetStatus)) {
    throw new InvalidDomainTransitionError("enrollment", from, targetStatus);
  }
  const statusRecord: EnrollmentStatusRecord =
    reason === undefined ? { status: targetStatus, changedAt } : { status: targetStatus, changedAt, reason };
  return { ...enrollment, statusHistory: [...enrollment.statusHistory, statusRecord], version: enrollment.version + 1 };
}

export function canTransitionAccessLinkStatus(from: AccessLinkStatus, to: AccessLinkStatus): boolean {
  return accessLinkTransitions[from].includes(to);
}

export function effectiveAccessLinkStatus(accessLink: AccessLink, now: IsoDateTime): AccessLinkStatus {
  if (accessLink.status === "active" && toEpoch(now) >= toEpoch(accessLink.expiresAt)) return "expired";
  return accessLink.status;
}

export function transitionAccessLink(
  accessLink: AccessLink,
  targetStatus: Exclude<AccessLinkStatus, "active">,
  changedAt: IsoDateTime,
): AccessLink {
  if (!canTransitionAccessLinkStatus(accessLink.status, targetStatus)) {
    throw new InvalidDomainTransitionError("access link", accessLink.status, targetStatus);
  }
  if (targetStatus === "consumed" && accessLink.usagePolicy !== "single_use") {
    throw new DomainInvariantError("Reusable access links are not consumed.");
  }
  if (targetStatus === "consumed") {
    return { ...accessLink, status: targetStatus, consumedAt: changedAt, version: accessLink.version + 1 };
  }
  if (targetStatus === "revoked") {
    return { ...accessLink, status: targetStatus, revokedAt: changedAt, version: accessLink.version + 1 };
  }
  return { ...accessLink, status: targetStatus, version: accessLink.version + 1 };
}

export type AccessDenialReason =
  | "enrollment_inactive"
  | "link_expired"
  | "link_revoked"
  | "link_consumed"
  | "link_inactive";

export type AccessDecision =
  | { readonly allowed: true; readonly enrollmentId: EnrollmentId; readonly usagePolicy: AccessLinkUsagePolicy }
  | { readonly allowed: false; readonly reason: AccessDenialReason };

export function evaluateAccessLink(
  enrollment: Enrollment,
  accessLink: AccessLink,
  now: IsoDateTime,
): AccessDecision {
  if (!isEnrollmentActive(enrollment)) return { allowed: false, reason: "enrollment_inactive" };
  const status = effectiveAccessLinkStatus(accessLink, now);
  if (status === "expired") return { allowed: false, reason: "link_expired" };
  if (status === "revoked") return { allowed: false, reason: "link_revoked" };
  if (status === "consumed") return { allowed: false, reason: "link_consumed" };
  if (status !== "active") return { allowed: false, reason: "link_inactive" };
  return { allowed: true, enrollmentId: enrollment.id, usagePolicy: accessLink.usagePolicy };
}

export interface VersionedCommand {
  readonly expectedVersion: number;
  readonly idempotencyKey: IdempotencyKey;
}

export interface ChangeEnrollmentStatusCommand extends VersionedCommand {
  readonly enrollmentId: EnrollmentId;
  readonly targetStatus: EnrollmentStatus;
  readonly changedAt: IsoDateTime;
  readonly reason?: string;
}

export interface EnrollmentCommandService {
  changeStatus(command: ChangeEnrollmentStatusCommand): Promise<Enrollment>;
}

export interface AccessTokenDigestVerifier {
  verify(candidate: AccessTokenCandidate, digest: TokenDigest): Promise<boolean>;
}

export interface AccessLinkLookupService {
  findByDigest(digest: TokenDigest): Promise<AccessLink | null>;
}

export interface SessionValidationRequest {
  readonly sessionId: SessionId;
  readonly now: IsoDateTime;
}

export interface ValidatedSession {
  readonly sessionId: SessionId;
  readonly enrollmentId: EnrollmentId;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly rotation: number;
}

export interface SessionValidator {
  validate(request: SessionValidationRequest): Promise<ValidatedSession | null>;
}
