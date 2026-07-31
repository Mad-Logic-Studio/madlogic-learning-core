import type {
  AccessLink,
  AccessLinkId,
  AccessLinkStatus,
  Course,
  CourseId,
  CourseRun,
  CourseRunId,
  Enrollment,
  EnrollmentId,
  EnrollmentStatus,
  EnrollmentStatusRecord,
  IsoDateTime,
  LearnerId,
  Lesson,
  LessonId,
  LessonProgress,
  ProgressState,
  TokenDigest,
} from "@madlogic-learning/core";

export type ClassroomEntitlementStatus = "active" | "revoked" | "refunded" | "cancelled" | "expired";
export type ClassroomLessonProgressState = "not_started" | "in_progress" | "completed";

export interface ClassroomCourseRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly status: "draft" | "published" | "archived";
  readonly created_at: string;
}

export interface ClassroomCohortRow {
  readonly id: string;
  readonly course_id: string;
  readonly slug: string;
  readonly starts_at: string;
  readonly ends_at: string;
}

export interface ClassroomLessonRow {
  readonly id: string;
  readonly course_id: string;
  readonly slug: string;
  readonly title: string;
  readonly position: number;
}

export interface ClassroomEntitlementRow {
  readonly id: string;
  readonly user_id: string;
  readonly cohort_id: string;
  readonly tier: string;
  readonly status: ClassroomEntitlementStatus;
  readonly version: number;
  readonly created_at: string;
}

export interface ClassroomEntitlementHistoryRow {
  readonly id: number;
  readonly status: EnrollmentStatus;
  readonly source_status: string;
  readonly reason: string | null;
  readonly changed_at: string;
}

export interface ClassroomAccessInvitationRow {
  readonly id: string;
  readonly entitlement_id: string;
  readonly invitation_digest: string;
  readonly expires_at: string;
  readonly consumed_at: string | null;
  readonly invalidated_at: string | null;
  readonly version: number;
  readonly created_at: string;
}

export interface ClassroomLessonProgressRow {
  readonly entitlement_id: string;
  readonly lesson_id: string;
  readonly state: ClassroomLessonProgressState;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly updated_at: string;
}

function asIsoDateTime(value: string): IsoDateTime {
  return value as IsoDateTime;
}

export function mapClassroomEntitlementStatus(status: ClassroomEntitlementStatus): EnrollmentStatus {
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  return "revoked";
}

export function mapClassroomCourse(
  row: ClassroomCourseRow,
  lessonRows: readonly ClassroomLessonRow[],
): Course {
  return {
    id: row.id as CourseId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    lessonIds: lessonRows
      .filter((lesson) => lesson.course_id === row.id)
      .sort((left, right) => left.position - right.position)
      .map((lesson) => lesson.id as LessonId),
    createdAt: asIsoDateTime(row.created_at),
  };
}

export function mapClassroomCohort(row: ClassroomCohortRow): CourseRun {
  return {
    id: row.id as CourseRunId,
    courseId: row.course_id as CourseId,
    deliveryModel: "cohort",
    startsAt: asIsoDateTime(row.starts_at),
    endsAt: asIsoDateTime(row.ends_at),
    cohortKey: row.slug,
  };
}

export function mapClassroomLesson(row: ClassroomLessonRow): Lesson {
  return {
    id: row.id as LessonId,
    courseId: row.course_id as CourseId,
    slug: row.slug,
    title: row.title,
    position: row.position,
  };
}

export function mapClassroomEnrollment(
  row: ClassroomEntitlementRow,
  historyRows: readonly ClassroomEntitlementHistoryRow[],
): Enrollment {
  const ordered = [...historyRows].sort((left, right) => left.id - right.id);
  const history: EnrollmentStatusRecord[] = [];

  for (const record of ordered) {
    if (history.at(-1)?.status === record.status) continue;
    const mapped: EnrollmentStatusRecord =
      record.reason === null
        ? { status: record.status, changedAt: asIsoDateTime(record.changed_at) }
        : { status: record.status, changedAt: asIsoDateTime(record.changed_at), reason: record.reason };
    history.push(mapped);
  }

  if (history[0]?.status !== "pending") {
    history.unshift({
      status: "pending",
      changedAt: asIsoDateTime(row.created_at),
      reason: "persistence_adapter_initial_state",
    });
  }

  const currentStatus = mapClassroomEntitlementStatus(row.status);
  if (history.at(-1)?.status !== currentStatus) {
    history.push({
      status: currentStatus,
      changedAt: asIsoDateTime(row.created_at),
      reason: "persistence_adapter_current_state",
    });
  }

  return {
    id: row.id as EnrollmentId,
    learnerId: row.user_id as LearnerId,
    courseRunId: row.cohort_id as CourseRunId,
    tier: row.tier,
    statusHistory: history,
    version: row.version,
    createdAt: asIsoDateTime(row.created_at),
  };
}

export function deriveClassroomAccessLinkStatus(
  row: ClassroomAccessInvitationRow,
  now: IsoDateTime,
): AccessLinkStatus {
  if (row.invalidated_at !== null) return "revoked";
  if (row.consumed_at !== null) return "consumed";
  if (Date.parse(now) >= Date.parse(row.expires_at)) return "expired";
  return "active";
}

export function mapClassroomAccessLink(
  row: ClassroomAccessInvitationRow,
  now: IsoDateTime,
): AccessLink {
  const base = {
    id: row.id as AccessLinkId,
    enrollmentId: row.entitlement_id as EnrollmentId,
    tokenDigest: row.invitation_digest as TokenDigest,
    status: deriveClassroomAccessLinkStatus(row, now),
    usagePolicy: "single_use" as const,
    expiresAt: asIsoDateTime(row.expires_at),
    version: row.version,
    createdAt: asIsoDateTime(row.created_at),
  };

  return {
    ...base,
    ...(row.consumed_at === null ? {} : { consumedAt: asIsoDateTime(row.consumed_at) }),
    ...(row.invalidated_at === null ? {} : { revokedAt: asIsoDateTime(row.invalidated_at) }),
  };
}

export function mapClassroomLessonProgress(row: ClassroomLessonProgressRow): LessonProgress {
  const state = row.state as ProgressState;
  return {
    enrollmentId: row.entitlement_id as EnrollmentId,
    lessonId: row.lesson_id as LessonId,
    state,
    ...(row.started_at === null ? {} : { startedAt: asIsoDateTime(row.started_at) }),
    ...(row.completed_at === null ? {} : { completedAt: asIsoDateTime(row.completed_at) }),
    updatedAt: asIsoDateTime(row.updated_at),
  };
}
