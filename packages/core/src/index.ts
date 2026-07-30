export type OpaqueId<TName extends string> = string & { readonly __opaque: TName };

export type LearnerId = OpaqueId<"LearnerId">;
export type CourseId = OpaqueId<"CourseId">;
export type CourseRunId = OpaqueId<"CourseRunId">;
export type LessonId = OpaqueId<"LessonId">;
export type EnrollmentId = OpaqueId<"EnrollmentId">;
export type AccessLinkId = OpaqueId<"AccessLinkId">;
export type LearningEventId = OpaqueId<"LearningEventId">;

export type IsoDateTime = string & { readonly __opaque: "IsoDateTime" };
export type DeliveryModel = "live" | "evergreen" | "cohort";
export type EnrollmentStatus = "pending" | "active" | "paused" | "completed" | "revoked" | "expired";
export type AccessLinkStatus = "active" | "revoked" | "consumed" | "expired";
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
  readonly createdAt: IsoDateTime;
}

export interface AccessLink {
  readonly id: AccessLinkId;
  readonly enrollmentId: EnrollmentId;
  readonly tokenHash: string;
  readonly status: AccessLinkStatus;
  readonly expiresAt: IsoDateTime;
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

export interface LearningEventPublisher {
  publish(event: LearningEvent): Promise<void>;
}

export function currentEnrollmentStatus(enrollment: Enrollment): EnrollmentStatus {
  const latest = enrollment.statusHistory.at(-1);
  if (!latest) throw new Error("Enrollment status history must not be empty.");
  return latest.status;
}

export function isEnrollmentActive(enrollment: Enrollment): boolean {
  return currentEnrollmentStatus(enrollment) === "active";
}
