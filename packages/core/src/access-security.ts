import type { CourseRun, IsoDateTime } from "./index.js";
import { AccessServiceError, type CleanRedirectDirective, type SecureRandomSource } from "./access-contracts.js";

const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toEpoch(value: IsoDateTime): number {
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) throw new AccessServiceError("Invalid timestamp.", "invalid_configuration");
  return epoch;
}

export function currentEnrollmentStatus(enrollment: {
  readonly statusHistory: readonly { readonly status: string }[];
}): string | undefined {
  return enrollment.statusHistory.at(-1)?.status;
}

export function courseRunIsAvailable(courseRun: CourseRun, now: IsoDateTime): boolean {
  const epoch = toEpoch(now);
  if (courseRun.startsAt !== undefined && epoch < toEpoch(courseRun.startsAt)) return false;
  if (courseRun.endsAt !== undefined && epoch >= toEpoch(courseRun.endsAt)) return false;
  return true;
}

export function encodeBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += BASE64_URL_ALPHABET[(value >> 18) & 63] ?? "";
    output += BASE64_URL_ALPHABET[(value >> 12) & 63] ?? "";
    if (second !== undefined) output += BASE64_URL_ALPHABET[(value >> 6) & 63] ?? "";
    if (third !== undefined) output += BASE64_URL_ALPHABET[value & 63] ?? "";
  }
  return output;
}

export function generateOpaqueToken(source: SecureRandomSource, byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 32) {
    throw new AccessServiceError("Access tokens require at least 32 random bytes.", "invalid_configuration");
  }
  const bytes = source.bytes(byteLength);
  if (bytes.length !== byteLength) {
    throw new AccessServiceError("Secure random source returned the wrong byte count.", "invalid_configuration");
  }
  return encodeBase64Url(bytes);
}

export function createCleanRedirect(destination: string, allowlist: readonly string[]): CleanRedirectDirective {
  const invalid =
    !destination.startsWith("/") ||
    destination.startsWith("//") ||
    destination.includes("\\") ||
    destination.includes("?") ||
    destination.includes("#") ||
    destination.includes("\0") ||
    !allowlist.includes(destination);
  if (invalid) throw new AccessServiceError("Redirect destination is not allowed.", "invalid_redirect");
  return {
    status: 303,
    location: destination,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  };
}

export function addSeconds(value: IsoDateTime, seconds: number): IsoDateTime {
  return new Date(toEpoch(value) + seconds * 1000).toISOString() as IsoDateTime;
}

export function tokenLooksValid(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,}$/u.test(value);
}
