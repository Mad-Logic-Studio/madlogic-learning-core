import type { AccessLinkId, EnrollmentId, IdempotencyKey, IsoDateTime, TokenDigest } from "./index.js";
import {
  AccessServiceError,
  type AccessInvitation,
  type IssueAccessInvitationResult,
} from "./access-contracts.js";
import { OneClickAccessService } from "./access-service.js";

OneClickAccessService.prototype.revokeAccessInvitation = async function (
  this: OneClickAccessService,
  id: AccessLinkId,
  reason: string,
): Promise<AccessInvitation> {
  return this.dependencies.transactions.transaction(async () => {
    const invitation = await this.dependencies.invitations.findById(id);
    if (invitation === null) throw new AccessServiceError("Invitation is unavailable.", "access_denied");
    if (invitation.status !== "active") return invitation;
    const now = this.dependencies.clock.now();
    const revoked: AccessInvitation = {
      ...invitation,
      status: "revoked",
      revokedAt: now,
      revocationReason: reason,
      version: invitation.version + 1,
    };
    await this.dependencies.invitations.save(revoked, invitation.version);
    const sessions = await this.dependencies.sessions.listActiveByInvitation(id);
    for (const session of sessions) await this.revokeSessionRecord(session, "invitation_revoked", now);
    await this.publish("access.invitation_revoked", now, {
      enrollmentId: revoked.enrollmentId,
      learnerId: revoked.learnerId,
      invitationId: revoked.id,
      payload: { reason },
    });
    return revoked;
  });
};

OneClickAccessService.prototype.regenerateAccessInvitation = async function (
  this: OneClickAccessService,
  enrollmentId: EnrollmentId,
  expiresAt: IsoDateTime,
  idempotencyKey: IdempotencyKey,
  requestHash: TokenDigest,
): Promise<IssueAccessInvitationResult> {
  return this.dependencies.transactions.transaction(async () => {
    const now = this.dependencies.clock.now();
    const claim = await this.dependencies.idempotency.claim(
      "access.invitation.regenerate",
      idempotencyKey,
      requestHash,
      now,
    );
    if (claim.outcome === "conflict") throw new AccessServiceError("Idempotency conflict.", "idempotency_conflict");
    if (claim.outcome === "replay") {
      const existing = await this.dependencies.invitations.findById(claim.responseReference as AccessLinkId);
      if (existing === null) throw new AccessServiceError("Replay target is missing.", "idempotency_replay_missing");
      return { outcome: "replayed", invitation: existing };
    }
    const access = await this.loadEnrollmentAccess(enrollmentId, now);
    if (!access.allowed) throw new AccessServiceError("Enrollment is not eligible.", "access_denied");
    const activeInvitations = await this.dependencies.invitations.listActiveByEnrollment(enrollmentId);
    let predecessor: AccessInvitation | undefined;
    for (const invitation of activeInvitations) {
      predecessor ??= invitation;
      const revoked: AccessInvitation = {
        ...invitation,
        status: "revoked",
        revokedAt: now,
        revocationReason: "regenerated",
        version: invitation.version + 1,
      };
      await this.dependencies.invitations.save(revoked, invitation.version);
      const sessions = await this.dependencies.sessions.listActiveByInvitation(invitation.id);
      for (const session of sessions) await this.revokeSessionRecord(session, "invitation_regenerated", now);
    }
    const created = await this.createInvitation(access.enrollment, expiresAt, now, predecessor?.id);
    if (predecessor !== undefined) {
      const linked: AccessInvitation = {
        ...predecessor,
        status: "revoked",
        revokedAt: predecessor.revokedAt ?? now,
        revocationReason: predecessor.revocationReason ?? "regenerated",
        replacedById: created.invitation.id,
        version: predecessor.version + 2,
      };
      await this.dependencies.invitations.save(linked, predecessor.version + 1);
    }
    await this.dependencies.idempotency.complete(
      "access.invitation.regenerate",
      idempotencyKey,
      created.invitation.id,
      now,
    );
    await this.publish("access.invitation_regenerated", now, {
      enrollmentId,
      learnerId: access.enrollment.learnerId,
      invitationId: created.invitation.id,
      payload: { prior_invitation_id: predecessor?.id ?? null },
    });
    return { outcome: "issued", invitation: created.invitation, rawToken: created.rawToken };
  });
};

OneClickAccessService.prototype.expireAccessInvitations = async function (
  this: OneClickAccessService,
): Promise<number> {
  return this.dependencies.transactions.transaction(async () => {
    const now = this.dependencies.clock.now();
    const expiring = await this.dependencies.invitations.listExpiring(now);
    let count = 0;
    for (const invitation of expiring) {
      if (invitation.status !== "active") continue;
      const expired: AccessInvitation = {
        ...invitation,
        status: "expired",
        version: invitation.version + 1,
      };
      await this.dependencies.invitations.save(expired, invitation.version);
      await this.publish("access.invitation_expired", now, {
        enrollmentId: expired.enrollmentId,
        learnerId: expired.learnerId,
        invitationId: expired.id,
        payload: {},
      });
      count += 1;
    }
    return count;
  });
};

OneClickAccessService.prototype.listActiveInvitations = async function (
  this: OneClickAccessService,
  enrollmentId: EnrollmentId,
): Promise<readonly AccessInvitation[]> {
  return this.dependencies.invitations.listActiveByEnrollment(enrollmentId);
};
