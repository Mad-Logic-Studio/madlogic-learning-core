import type {
  AccessLinkId,
  EnrollmentId,
  IsoDateTime,
  LearnerId,
  SessionId,
  TokenDigest,
} from "@madlogic-learning/core";
import type {
  AccessInvitation,
  AccessInvitationStatus,
  LearnerSession,
  LearnerSessionStatus,
} from "@madlogic-learning/core/access";

export interface ClassroomAccessInvitationPersistenceRow {
  readonly id: string;
  readonly invitation_digest: string;
  readonly user_id: string;
  readonly entitlement_id: string;
  readonly usage_policy: "reusable" | "single_use";
  readonly consumed_at: string | null;
  readonly expires_at: string;
  readonly invalidated_at: string | null;
  readonly expired_at: string | null;
  readonly last_exchanged_at: string | null;
  readonly exchange_count: number;
  readonly revocation_reason: string | null;
  readonly regenerated_from_id: string | null;
  readonly replaced_by_id: string | null;
  readonly version: number;
  readonly created_at: string;
}

export interface ClassroomSessionPersistenceRow {
  readonly id: string;
  readonly session_digest: string;
  readonly user_id: string;
  readonly entitlement_id: string;
  readonly invitation_id: string;
  readonly status: LearnerSessionStatus;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly last_seen_at: string;
  readonly rotation: number;
  readonly version: number;
  readonly revoked_at: string | null;
  readonly revocation_reason: string | null;
  readonly client_digest: string | null;
}

function asIso(value: string): IsoDateTime {
  return value as IsoDateTime;
}

export function deriveInvitationStatus(
  row: ClassroomAccessInvitationPersistenceRow,
  now: IsoDateTime,
): AccessInvitationStatus {
  if (row.invalidated_at !== null) return "revoked";
  if (row.usage_policy === "single_use" && row.consumed_at !== null) return "consumed";
  if (row.expired_at !== null || Date.parse(now) >= Date.parse(row.expires_at)) return "expired";
  return "active";
}

export function mapClassroomAccessInvitation(
  row: ClassroomAccessInvitationPersistenceRow,
  now: IsoDateTime,
): AccessInvitation {
  return {
    id: row.id as AccessLinkId,
    enrollmentId: row.entitlement_id as EnrollmentId,
    learnerId: row.user_id as LearnerId,
    tokenDigest: row.invitation_digest as TokenDigest,
    status: deriveInvitationStatus(row, now),
    usagePolicy: row.usage_policy,
    expiresAt: asIso(row.expires_at),
    version: row.version,
    createdAt: asIso(row.created_at),
    exchangeCount: row.exchange_count,
    ...(row.last_exchanged_at === null ? {} : { lastExchangedAt: asIso(row.last_exchanged_at) }),
    ...(row.invalidated_at === null ? {} : { revokedAt: asIso(row.invalidated_at) }),
    ...(row.consumed_at === null ? {} : { consumedAt: asIso(row.consumed_at) }),
    ...(row.revocation_reason === null ? {} : { revocationReason: row.revocation_reason }),
    ...(row.regenerated_from_id === null
      ? {}
      : { regeneratedFromId: row.regenerated_from_id as AccessLinkId }),
    ...(row.replaced_by_id === null ? {} : { replacedById: row.replaced_by_id as AccessLinkId }),
  };
}

export function mapClassroomSession(row: ClassroomSessionPersistenceRow): LearnerSession {
  return {
    id: row.id as SessionId,
    enrollmentId: row.entitlement_id as EnrollmentId,
    learnerId: row.user_id as LearnerId,
    invitationId: row.invitation_id as AccessLinkId,
    sessionDigest: row.session_digest as TokenDigest,
    status: row.status,
    issuedAt: asIso(row.issued_at),
    expiresAt: asIso(row.expires_at),
    lastSeenAt: asIso(row.last_seen_at),
    rotation: row.rotation,
    version: row.version,
    ...(row.revoked_at === null ? {} : { revokedAt: asIso(row.revoked_at) }),
    ...(row.revocation_reason === null ? {} : { revocationReason: row.revocation_reason }),
    ...(row.client_digest === null ? {} : { clientDigest: row.client_digest as TokenDigest }),
  };
}

export const classroomAccessSql = Object.freeze({
  findInvitationByDigest: `
    select *
    from public.classroom_access_invitations
    where invitation_digest = $1
    limit 1
  `,
  listActiveInvitationsByEnrollment: `
    select *
    from public.classroom_access_invitations
    where entitlement_id = $1
      and invalidated_at is null
      and expired_at is null
      and expires_at > $2
    order by created_at desc
  `,
  findSessionByDigest: `
    select *
    from public.classroom_sessions
    where session_digest = $1
    limit 1
  `,
  listActiveSessionsByEnrollment: `
    select *
    from public.classroom_sessions
    where entitlement_id = $1
      and status = 'active'
      and expires_at > $2
    order by issued_at desc
  `,
  optimisticSessionUpdate: `
    update public.classroom_sessions
    set status = $3,
        revoked_at = $4,
        revocation_reason = $5
    where id = $1
      and version = $2
    returning *
  `,
});
