import type { Enrollment, EnrollmentId, Learner, LearnerId, LessonProgress } from "@madlogic-learning/core";

export interface TransactionContext {
  readonly transactionId: string;
}

export interface LearnerRepository {
  findById(id: LearnerId, context?: TransactionContext): Promise<Learner | null>;
  save(learner: Learner, context?: TransactionContext): Promise<void>;
}

export interface EnrollmentRepository {
  findById(id: EnrollmentId, context?: TransactionContext): Promise<Enrollment | null>;
  save(enrollment: Enrollment, context?: TransactionContext): Promise<void>;
}

export interface LessonProgressRepository {
  save(progress: LessonProgress, context?: TransactionContext): Promise<void>;
}

export interface PostgresUnitOfWork {
  transaction<TResult>(operation: (context: TransactionContext) => Promise<TResult>): Promise<TResult>;
}

export const migrationConvention = Object.freeze({
  directory: "migrations",
  filename: "YYYYMMDDHHMM_description.sql",
  policy: "append-only after release",
});
