import type {
  AccessLink,
  AccessLinkId,
  Enrollment,
  EnrollmentId,
  IsoDateTime,
  Learner,
  LearnerId,
  LearningEvent,
  LessonProgress,
} from "@madlogic-learning/core";

export interface TransactionContext {
  readonly transactionId: string;
}

export interface VersionedSaveOptions {
  readonly expectedVersion: number | null;
}

export class PersistenceConflictError extends Error {
  constructor(
    message: string,
    readonly code: "concurrency_conflict" | "duplicate_record" | "idempotency_conflict",
  ) {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

export interface LearnerRepository {
  findById(id: LearnerId, context?: TransactionContext): Promise<Learner | null>;
  save(learner: Learner, context?: TransactionContext): Promise<void>;
}

export interface EnrollmentRepository {
  findById(id: EnrollmentId, context?: TransactionContext): Promise<Enrollment | null>;
  save(enrollment: Enrollment, options: VersionedSaveOptions, context?: TransactionContext): Promise<void>;
}

export interface AccessLinkRepository {
  findById(id: AccessLinkId, context?: TransactionContext): Promise<AccessLink | null>;
  save(accessLink: AccessLink, options: VersionedSaveOptions, context?: TransactionContext): Promise<void>;
}

export interface LessonProgressRepository {
  save(progress: LessonProgress, context?: TransactionContext): Promise<void>;
}

export type IdempotencyStatus = "started" | "completed" | "failed";

export interface IdempotencyRecord {
  readonly key: string;
  readonly operation: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly createdAt: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly responseReference?: string;
}

export interface IdempotencyRepository {
  claim(record: IdempotencyRecord, context?: TransactionContext): Promise<IdempotencyRecord>;
  complete(
    key: string,
    completedAt: IsoDateTime,
    responseReference: string,
    context?: TransactionContext,
  ): Promise<IdempotencyRecord>;
  findByKey(key: string, context?: TransactionContext): Promise<IdempotencyRecord | null>;
}

export interface OutboxRecord {
  readonly id: string;
  readonly event: LearningEvent;
  readonly occurredAt: IsoDateTime;
  readonly publishedAt?: IsoDateTime;
}

export interface OutboxRepository {
  append(record: OutboxRecord, context?: TransactionContext): Promise<void>;
  listPending(context?: TransactionContext): Promise<readonly OutboxRecord[]>;
}

export interface PostgresUnitOfWork {
  transaction<TResult>(operation: (context: TransactionContext) => Promise<TResult>): Promise<TResult>;
}

export const migrationConvention = Object.freeze({
  directory: "migrations",
  filename: "YYYYMMDDHHMMSS_description.sql",
  ordering: "lexicographic timestamp order",
  transactionPolicy: "one migration per transaction unless explicitly documented",
  policy: "append-only after release; never edit an applied migration",
});
