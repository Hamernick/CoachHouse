-- Durable account access follows an explicit verified claim. Matching email
-- alone never discovers or claims an application. No staff-project/table grant.
create function public.fiscal_linked_applicant_access(p_reference uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fiscal_guest_submissions s
    join auth.users u on u.id = s.claimed_user_id
    where s.id = p_reference and u.id = auth.uid()
      and s.claimed_org_id = u.id and s.claimed_at is not null
      and s.email_verified_at is not null and u.email_confirmed_at is not null
      and lower(btrim(u.email)) = lower(btrim(s.contact_email))
  );
$$;
revoke all on function public.fiscal_linked_applicant_access(uuid) from public, anon, authenticated;

-- Existing trusted guest RPCs keep their browser proof path. Account wrappers
-- below supply no bearer key and must separately pass the linked-account check.
create or replace function public.fiscal_guest_application_access(p_reference uuid,p_key_hash text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.fiscal_linked_applicant_access(p_reference) or exists (
    select 1 from public.fiscal_guest_submissions s
    join public.fiscal_guest_verified_sessions v on v.submission_id = s.id
    where s.id = p_reference and s.email_verified_at is not null
      and v.key_hash = p_key_hash and v.expires_at > now()
  );
$$;

create function public.list_linked_fiscal_applications()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(recent) order by recent."submittedAt" desc, recent.reference), '[]'::jsonb)
  from (
    select s.id as reference, a.project_name as "projectName", a.status,
      s.created_at as "submittedAt"
    from public.fiscal_guest_submissions s
    join public.fiscal_sponsorship_applications a on a.id = s.application_id
    where s.claimed_user_id = auth.uid() and public.fiscal_linked_applicant_access(s.id)
    order by s.created_at desc, s.id limit 100
  ) recent;
$$;

create function public.read_linked_fiscal_application(p_reference uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.fiscal_linked_applicant_access(p_reference) then return null; end if;
  return public.read_fiscal_guest_application(p_reference, null);
end $$;

create function public.resubmit_linked_fiscal_application(
  p_reference uuid, p_request_id uuid, p_version text, p_application jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.fiscal_linked_applicant_access(p_reference) then return null; end if;
  -- Reuse the same locked, versioned, idempotent correction transaction/outbox.
  return public.resubmit_fiscal_guest_application(p_reference, null, p_request_id, p_version, p_application);
end $$;

revoke all on function public.list_linked_fiscal_applications(), public.read_linked_fiscal_application(uuid),
  public.resubmit_linked_fiscal_application(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.list_linked_fiscal_applications(), public.read_linked_fiscal_application(uuid),
  public.resubmit_linked_fiscal_application(uuid,uuid,text,jsonb) to authenticated;

-- Rollback: restore fiscal_guest_application_access from20261011090000 first,
-- then drop the three linked-account RPCs and fiscal_linked_applicant_access.
-- Preserve claimed applications/import receipts; no data migration to reverse.
