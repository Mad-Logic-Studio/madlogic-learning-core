import { currentEnrollmentStatus, type Enrollment } from "@madlogic-learning/core";
import type { LearningRequestContext } from "@madlogic-learning/cloudflare";
import type { EnrollmentRepository } from "@madlogic-learning/postgres";

export interface ExampleComposition {
  readonly enrollments: EnrollmentRepository;
  readonly requestContext: LearningRequestContext;
}

export function describeEnrollment(enrollment: Enrollment): string {
  return `${enrollment.id}:${currentEnrollmentStatus(enrollment)}`;
}
