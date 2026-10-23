begin;

-- Associate the applicant organization without moving the staff project or files.
create table public.fiscal_application_organization_links (
  submission_id uuid primary key references public.fiscal_guest_submissions(id),
  org_id uuid not null unique references public.organizations(user_id),
  applicant_user_id uuid not null references public.profiles(id),
  actor_id uuid not null references public.profiles(id),
  basis text not null check (basis in ('verified_applicant','staff_confirmed_owner')),
  request_id uuid not null,
  request_hash text not null,
  unique(actor_id,request_id),
  created_at timestamptz not null default now()
);
alter table public.fiscal_application_organization_links enable row level security;
alter table public.fiscal_application_organization_links force row level security;
revoke all on public.fiscal_application_organization_links from public,anon,authenticated;
grant select,insert on public.fiscal_application_organization_links to service_role;

create function public.fiscal_org_applicant_access(p_org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.organizations o on o.user_id=p_org_id
 where u.id=auth.uid() and u.email_confirmed_at is not null and
 (o.user_id=u.id or exists(select 1 from public.organization_memberships m
 where m.org_id=o.user_id and m.member_id=u.id and m.role in ('owner','admin','staff'))));
$$;
revoke all on function public.fiscal_org_applicant_access(uuid) from public,anon,authenticated;

-- Internal common transition. Callers establish verified applicant or reviewer authority.
create function public.attach_fiscal_application_organization(
 p_reference uuid,p_org_id uuid,p_actor_id uuid,p_request_id uuid,p_basis text,p_request_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.fiscal_guest_submissions%rowtype; l public.fiscal_application_organization_links%rowtype;
begin
 if p_request_id is null or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{32}$' or p_basis not in ('verified_applicant','staff_confirmed_owner') then
 raise exception 'Invalid attachment' using errcode='22023'; end if;
 select * into s from public.fiscal_guest_submissions where id=p_reference for update;
 if not found then return jsonb_build_object('state','denied'); end if;
 -- Serialize this destination with optional profile imports and other attachments.
 perform pg_advisory_xact_lock(hashtextextended('fiscal-profile:'||p_org_id::text,0));
 if not exists(select 1 from public.organizations o join auth.users u on u.id=o.user_id
 where o.user_id=p_org_id and u.email_confirmed_at is not null
 and lower(btrim(u.email))=lower(btrim(s.contact_email)))
 or exists(select 1 from public.fiscal_guest_intake_settings c where c.org_id=p_org_id)
 then return jsonb_build_object('state','denied'); end if;
 select * into l from public.fiscal_application_organization_links where submission_id=s.id;
 if found then
  if l.request_id=p_request_id and (l.request_hash<>p_request_hash or l.actor_id<>p_actor_id or l.basis<>p_basis) then
   return jsonb_build_object('state','conflict'); end if;
  if l.org_id=p_org_id then
   return jsonb_build_object('state','linked','organizationId',l.org_id); end if;
  return jsonb_build_object('state','conflict');
 end if;
 if exists(select 1 from public.fiscal_application_organization_links where actor_id=p_actor_id and request_id=p_request_id)
 or (s.claimed_org_id is not null and s.claimed_org_id<>p_org_id)
 or exists(select 1 from public.fiscal_application_organization_links where org_id=p_org_id)
 or exists(select 1 from public.fiscal_sponsorship_applications where org_id=p_org_id)
 then return jsonb_build_object('state','conflict'); end if;
 insert into public.fiscal_application_organization_links(submission_id,org_id,applicant_user_id,actor_id,basis,request_id,request_hash)
 values(s.id,p_org_id,p_org_id,p_actor_id,p_basis,p_request_id,p_request_hash);
 return jsonb_build_object('state','linked','organizationId',p_org_id);
end $$;
revoke all on function public.attach_fiscal_application_organization(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

-- Search is limited to this application's confirmed matching-email owner.
create function public.search_fiscal_organization_link(p_project_id uuid,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.fiscal_guest_submissions%rowtype; candidates jsonb; linked jsonb;
begin
 if public.fiscal_guest_project_reviewer_access(p_project_id,auth.uid()) is distinct from true
 then return null; end if;
 select * into s from public.fiscal_guest_submissions where project_id=p_project_id;
 select jsonb_build_object('organizationId',l.org_id,'name',coalesce(nullif(o.profile->>'name',''),'Organization')) into linked
 from public.fiscal_application_organization_links l join public.organizations o on o.user_id=l.org_id where l.submission_id=s.id;
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',o.user_id,
 'name',coalesce(nullif(o.profile->>'name',''),'Organization'),'ownerEmail',u.email,
 'version',md5(jsonb_build_object('submission',to_jsonb(s),'organization',to_jsonb(o),'email',u.email,'confirmed',u.email_confirmed_at)::text))
 order by o.user_id),'[]'::jsonb) into candidates
 from public.organizations o join auth.users u on u.id=o.user_id
 where u.email_confirmed_at is not null and lower(btrim(u.email))=lower(btrim(s.contact_email))
 and not exists(select 1 from public.fiscal_guest_intake_settings c where c.org_id=o.user_id)
 and length(btrim(p_query)) between 2 and 100
 and (strpos(lower(coalesce(o.profile->>'name','')),lower(btrim(p_query)))>0 or strpos(lower(u.email),lower(btrim(p_query)))>0);
 return jsonb_build_object('linked',linked,'candidates',candidates);
end $$;

create function public.link_fiscal_organization(p_project_id uuid,p_org_id uuid,p_request_id uuid,p_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.fiscal_guest_submissions%rowtype; actual text; existing public.fiscal_application_organization_links%rowtype;
begin
 if auth.uid() is null or public.fiscal_guest_project_reviewer_access(p_project_id,auth.uid()) is distinct from true
 then return jsonb_build_object('state','denied'); end if;
 select * into s from public.fiscal_guest_submissions where project_id=p_project_id for update;
 if not found then return jsonb_build_object('state','denied'); end if;
 select * into existing from public.fiscal_application_organization_links where submission_id=s.id;
 if found then
  if existing.org_id<>p_org_id then return jsonb_build_object('state','conflict'); end if;
  return public.attach_fiscal_application_organization(s.id,p_org_id,auth.uid(),p_request_id,'staff_confirmed_owner',md5(jsonb_build_object('project',p_project_id,'org',p_org_id,'version',p_version)::text));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('fiscal-profile:'||p_org_id::text,0));
 select md5(jsonb_build_object('submission',to_jsonb(s),'organization',to_jsonb(o),'email',u.email,'confirmed',u.email_confirmed_at)::text)
 into actual from public.organizations o join auth.users u on u.id=o.user_id where o.user_id=p_org_id for update of o;
 if actual is null or p_version is distinct from actual then return jsonb_build_object('state','conflict'); end if;
 return public.attach_fiscal_application_organization(s.id,p_org_id,auth.uid(),p_request_id,'staff_confirmed_owner',md5(jsonb_build_object('project',p_project_id,'org',p_org_id,'version',p_version)::text));
end $$;
revoke all on function public.search_fiscal_organization_link(uuid,text),public.link_fiscal_organization(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.search_fiscal_organization_link(uuid,text),public.link_fiscal_organization(uuid,uuid,uuid,text) to authenticated;

-- Preserve the existing selected-field import and proof checks; link in the same transaction.
alter function public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb) rename to save_fiscal_guest_profile_before_org_link;
revoke all on function public.save_fiscal_guest_profile_before_org_link(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.save_fiscal_guest_profile(p_reference uuid,p_key_hash text,p_user_id uuid,p_request_id uuid,p_version text,p_fields jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; linked jsonb;
begin
 -- Catch inside a subtransaction so a conflict rolls back profile imports too.
 begin
  result:=public.save_fiscal_guest_profile_before_org_link(p_reference,p_key_hash,p_user_id,p_request_id,p_version,p_fields);
  if result->>'state' in ('linked','already_linked') then
   linked:=public.attach_fiscal_application_organization(p_reference,p_user_id,p_user_id,p_request_id,'verified_applicant',md5(jsonb_build_object('version',p_version,'fields',p_fields)::text));
   if linked->>'state'<>'linked' then raise exception 'Organization linkage conflict' using errcode='P0002'; end if;
  end if;
  return result;
 exception when sqlstate 'P0002' then return jsonb_build_object('state','conflict'); end;
end $$;
revoke all on function public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb) to service_role;

-- Existing single explicit claims converge without overwriting any application/profile.
insert into public.fiscal_application_organization_links(submission_id,org_id,applicant_user_id,actor_id,basis,request_id,request_hash,created_at)
select s.id,s.claimed_org_id,s.claimed_user_id,s.claimed_user_id,'verified_applicant',i.request_id,i.request_hash,s.claimed_at
from public.fiscal_guest_submissions s join public.fiscal_guest_profile_imports i on i.submission_id=s.id
join auth.users u on u.id=s.claimed_user_id
where s.claimed_org_id=s.claimed_user_id and s.email_verified_at is not null and u.email_confirmed_at is not null
and lower(btrim(u.email))=lower(btrim(s.contact_email))
and (select count(*) from public.fiscal_guest_submissions x where x.claimed_org_id=s.claimed_org_id)=1
and not exists(select 1 from public.fiscal_sponsorship_applications a where a.org_id=s.claimed_org_id)
and not exists(select 1 from public.fiscal_guest_intake_settings c where c.org_id=s.claimed_org_id);

create or replace function public.fiscal_linked_applicant_access(p_reference uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.fiscal_guest_submissions s join auth.users u on u.id=s.claimed_user_id
 where s.id=p_reference and u.id=auth.uid() and s.claimed_org_id=u.id and s.claimed_at is not null
 and s.email_verified_at is not null and u.email_confirmed_at is not null and lower(btrim(u.email))=lower(btrim(s.contact_email)))
 or exists(select 1 from public.fiscal_application_organization_links l
 join public.fiscal_guest_submissions s on s.id=l.submission_id join auth.users owner on owner.id=l.applicant_user_id
 where l.submission_id=p_reference and owner.email_confirmed_at is not null
 and lower(btrim(owner.email))=lower(btrim(s.contact_email)) and public.fiscal_org_applicant_access(l.org_id));
$$;

create function public.list_fiscal_organization_applications(p_org_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('reference',s.id,'projectName',a.project_name,'status',a.status,'submittedAt',s.created_at)),'[]'::jsonb)
 from public.fiscal_application_organization_links l join public.fiscal_guest_submissions s on s.id=l.submission_id
 join public.fiscal_sponsorship_applications a on a.id=s.application_id
 where l.org_id=p_org_id and public.fiscal_org_applicant_access(p_org_id) and public.fiscal_linked_applicant_access(s.id);
$$;
revoke all on function public.list_fiscal_organization_applications(uuid) from public,anon,authenticated;
grant execute on function public.list_fiscal_organization_applications(uuid) to authenticated;

-- Optional-profile reopening selects only the account's own organization, including
-- legacy explicit claims intentionally excluded from the one-application backfill.
create function public.fiscal_profile_owner_linked(p_reference uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.fiscal_linked_applicant_access(p_reference) and (
 exists(select 1 from public.fiscal_guest_submissions s where s.id=p_reference and s.claimed_user_id=auth.uid() and s.claimed_org_id=auth.uid())
 or exists(select 1 from public.fiscal_application_organization_links l where l.submission_id=p_reference and l.org_id=auth.uid() and l.applicant_user_id=auth.uid()));
$$;
revoke all on function public.fiscal_profile_owner_linked(uuid) from public,anon,authenticated;
grant execute on function public.fiscal_profile_owner_linked(uuid) to authenticated;

-- Staff review reflects either explicit association or the preserved legacy claim.
create or replace function public.get_fiscal_guest_project_summary(p_project_id uuid,p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.fiscal_guest_project_reviewer_access(p_project_id,p_user_id) is distinct from true then return null; end if;
 return (select jsonb_build_object('projectId',p.id,'projectName',p.name,
 'accountLinked',exists(select 1 from public.fiscal_application_organization_links l where l.submission_id=s.id)
 or (s.claimed_user_id is not null and s.claimed_org_id is not null and s.claimed_at is not null and s.email_verified_at is not null),
 'emailVerified',s.email_verified_at is not null)
 from public.organization_projects p join public.fiscal_guest_submissions s on s.project_id=p.id where p.id=p_project_id);
end $$;

-- Serialize ordinary application creation against attachments to prevent a second flow.
create function public.prevent_fiscal_linked_duplicate()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('fiscal-profile:'||new.org_id::text,0));
 if exists(select 1 from public.fiscal_application_organization_links where org_id=new.org_id) then
  raise exception 'This organization already has a linked fiscal application. Open its existing application.' using errcode='23505';
 end if;
 return new;
end $$;
revoke all on function public.prevent_fiscal_linked_duplicate() from public,anon,authenticated;
create trigger fiscal_linked_application_no_duplicate before insert or update of org_id on public.fiscal_sponsorship_applications
for each row execute function public.prevent_fiscal_linked_duplicate();

commit;
-- Rollback requires restoring the prior fiscal_linked_applicant_access definition,
-- dropping the new trigger/RPCs and renaming the retained profile-save function.
-- Preserve fiscal_application_organization_links as audit evidence; never reparent records.
