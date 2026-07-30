import type { EnrollmentId, LearnerId } from "@madlogic-learning/core";

export interface RuntimeBindings {
  readonly environmentName: string;
}

export interface CookieOptions {
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "strict" | "lax" | "none";
  readonly maxAgeSeconds?: number;
  readonly path?: string;
}

export interface SessionCookieWriter {
  create(name: string, value: string, options: CookieOptions): string;
  clear(name: string, options: CookieOptions): string;
}

export interface LearningRequestContext<TBindings extends RuntimeBindings = RuntimeBindings> {
  readonly requestId: string;
  readonly bindings: TBindings;
  readonly learnerId?: LearnerId;
  readonly enrollmentId?: EnrollmentId;
}
