import type { EnrollmentId, LearnerId, TokenDigest } from "@madlogic-learning/core";
import type {
  AccessDigestService,
  CleanRedirectDirective,
  SecureRandomSource,
  SessionCookieDirective,
} from "@madlogic-learning/core/access";

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

export interface RequestCookieReader {
  get(cookieHeader: string | null, name: string): string | null;
}

export interface RedirectResponseFactory {
  create(directive: CleanRedirectDirective, setCookie?: string): {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
  };
}

export interface RequestMetadata {
  readonly requestId: string;
  readonly method: string;
  readonly origin?: string;
  readonly clientDigest?: TokenDigest;
  readonly userAgentDigest?: TokenDigest;
}

export interface LearningRequestContext<TBindings extends RuntimeBindings = RuntimeBindings> {
  readonly requestId: string;
  readonly bindings: TBindings;
  readonly metadata?: RequestMetadata;
  readonly learnerId?: LearnerId;
  readonly enrollmentId?: EnrollmentId;
}

function bytesToHex(bytes: Uint8Array): string {
  let result = "";
  for (const value of bytes) result += value.toString(16).padStart(2, "0");
  return result;
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[a-f0-9]{64}$/u.test(value)) return null;
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    const pair = value.slice(index * 2, index * 2 + 2);
    result[index] = Number.parseInt(pair, 16);
  }
  return result;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export class WebCryptoSecureRandomSource implements SecureRandomSource {
  constructor(private readonly cryptoProvider: Crypto = globalThis.crypto) {}

  bytes(length: number): Uint8Array {
    if (!Number.isInteger(length) || length < 1 || length > 65_536) {
      throw new RangeError("Secure random byte length is invalid.");
    }
    return this.cryptoProvider.getRandomValues(new Uint8Array(length));
  }
}

export class WebCryptoAccessDigestService implements AccessDigestService {
  private readonly encoder = new TextEncoder();

  constructor(private readonly cryptoProvider: Crypto = globalThis.crypto) {}

  async digest(value: string): Promise<TokenDigest> {
    const bytes = this.encoder.encode(value);
    const digest = await this.cryptoProvider.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest)) as TokenDigest;
  }

  async matches(candidate: string, digest: TokenDigest): Promise<boolean> {
    const candidateDigest = hexToBytes(await this.digest(candidate));
    const expectedDigest = hexToBytes(digest);
    if (candidateDigest === null || expectedDigest === null) return false;
    return constantTimeEqual(candidateDigest, expectedDigest);
  }
}

function assertCookieName(value: string): void {
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(value)) throw new TypeError("Cookie name is invalid.");
}

function assertCookiePath(value: string): void {
  if (!value.startsWith("/") || /[;\r\n]/u.test(value)) throw new TypeError("Cookie path is invalid.");
}

function encodeCookieValue(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new TypeError("Opaque cookie value is invalid.");
  return value;
}

export class CloudflareSessionCookieWriter implements SessionCookieWriter {
  create(name: string, value: string, options: CookieOptions): string {
    assertCookieName(name);
    const path = options.path ?? "/";
    assertCookiePath(path);
    const fields = [`${name}=${encodeCookieValue(value)}`, `Path=${path}`];
    if (options.maxAgeSeconds !== undefined) fields.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
    if (options.httpOnly) fields.push("HttpOnly");
    if (options.secure) fields.push("Secure");
    fields.push(`SameSite=${options.sameSite === "lax" ? "Lax" : options.sameSite === "strict" ? "Strict" : "None"}`);
    return fields.join("; ");
  }

  clear(name: string, options: CookieOptions): string {
    return this.create(name, "deleted", { ...options, maxAgeSeconds: 0 });
  }

  createLearnerSession(directive: SessionCookieDirective): string {
    return this.create(directive.name, directive.value, {
      httpOnly: directive.httpOnly,
      secure: directive.secure,
      sameSite: directive.sameSite,
      path: directive.path,
      maxAgeSeconds: directive.maxAgeSeconds,
    });
  }
}

export class CloudflareRequestCookieReader implements RequestCookieReader {
  get(cookieHeader: string | null, name: string): string | null {
    assertCookieName(name);
    if (cookieHeader === null) return null;
    for (const field of cookieHeader.split(";")) {
      const separator = field.indexOf("=");
      if (separator < 1) continue;
      if (field.slice(0, separator).trim() === name) return field.slice(separator + 1).trim();
    }
    return null;
  }
}

export class CloudflareRedirectResponseFactory implements RedirectResponseFactory {
  create(directive: CleanRedirectDirective, setCookie?: string): {
    readonly status: number;
    readonly headers: Readonly<Record<string, string>>;
  } {
    const headers: Record<string, string> = {
      Location: directive.location,
      "Cache-Control": directive.headers["Cache-Control"],
      "Referrer-Policy": directive.headers["Referrer-Policy"],
    };
    if (setCookie !== undefined) headers["Set-Cookie"] = setCookie;
    return { status: directive.status, headers };
  }
}

export function redactAccessSecrets(message: string, secretValues: readonly string[]): string {
  let redacted = message;
  for (const secret of secretValues) {
    if (secret.length > 0) redacted = redacted.split(secret).join("[REDACTED]");
  }
  return redacted;
}
