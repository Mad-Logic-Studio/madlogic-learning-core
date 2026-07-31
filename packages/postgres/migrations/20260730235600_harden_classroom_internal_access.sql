-- Explicitly document and enforce server-only access for internal classroom data.
-- These tables already had RLS enabled and no client policies; adding restrictive
-- deny policies preserves that behavior while making the intent auditable.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

comment on function public.rls_auto_enable() is
  'Administrative event-trigger function. It is not callable through the public API.';

drop policy if exists no_client_access_invitations on public.classroom_access_invitations;
create policy no_client_access_invitations
on public.classroom_access_invitations
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_purchase_provisions on public.classroom_purchase_provisions;
create policy no_client_access_purchase_provisions
on public.classroom_purchase_provisions
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_purchase_reversals on public.classroom_purchase_reversals;
create policy no_client_access_purchase_reversals
on public.classroom_purchase_reversals
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_recovery_requests on public.classroom_recovery_requests;
create policy no_client_access_recovery_requests
on public.classroom_recovery_requests
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_verification_rate_limits on public.classroom_verification_rate_limits;
create policy no_client_access_verification_rate_limits
on public.classroom_verification_rate_limits
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_entitlement_events on public.entitlement_events;
create policy no_client_access_entitlement_events
on public.entitlement_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.classroom_access_invitations from anon, authenticated;
revoke all on public.classroom_purchase_provisions from anon, authenticated;
revoke all on public.classroom_purchase_reversals from anon, authenticated;
revoke all on public.classroom_recovery_requests from anon, authenticated;
revoke all on public.classroom_verification_rate_limits from anon, authenticated;
revoke all on public.entitlement_events from anon, authenticated;
