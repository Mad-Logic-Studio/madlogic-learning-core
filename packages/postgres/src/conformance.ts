import type { Enrollment, EnrollmentId } from "@madlogic-learning/core";
import type { EnrollmentRepository } from "./contracts.js";

export interface EnrollmentRepositoryConformanceResult {
  readonly checks: readonly string[];
}

export async function exerciseEnrollmentRepositoryContract(
  repository: EnrollmentRepository,
  initial: Enrollment,
  updated: Enrollment,
): Promise<EnrollmentRepositoryConformanceResult> {
  const checks: string[] = [];
  await repository.save(initial, { expectedVersion: null });
  const loaded = await repository.findById(initial.id);
  if (loaded?.version !== initial.version) throw new Error("Repository did not preserve the inserted version.");
  checks.push("insert-and-load");

  await repository.save(updated, { expectedVersion: initial.version });
  const reloaded = await repository.findById(updated.id);
  if (reloaded?.version !== updated.version) throw new Error("Repository did not preserve the updated version.");
  checks.push("expected-version-update");

  const missing = await repository.findById("missing" as EnrollmentId);
  if (missing !== null) throw new Error("Repository must return null for a missing enrollment.");
  checks.push("missing-is-null");

  return { checks };
}
