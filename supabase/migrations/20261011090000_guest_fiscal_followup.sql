-- Private applicant return and atomic corrections. No anonymous table access.
create function public.fiscal_guest_editable_fields() returns text[]
language sql immutable set search_path = '' as $$ select array['applicant_full_name','applicant_first_name','applicant_last_name','mailing_street_address','mailing_street_address_2','mailing_city','mailing_state','mailing_postal_code','phone_number','primary_email','legal_entity_type','legal_entity_has_501c3','formation_status','project_name','project_duration_type','temporary_start_date','temporary_end_date','focus_area','project_description','project_location','estimated_budget_cents','expense_summary','prospective_funding_sources','public_benefit','leadership_background','initiative_history','operates_outside_united_states','engages_in_lobbying','has_legal_compliance_financial_concerns','concerns_explanation']::text[] $$;

create function public.fiscal_guest_application_access(p_reference uuid,p_key_hash text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.fiscal_guest_submissions s
 join public.fiscal_guest_verified_sessions v on v.submission_id=s.id
 where s.id=p_reference and s.email_verified_at is not null
 and v.key_hash=p_key_hash and v.expires_at>now());
$$;

create table public.fiscal_guest_application_revisions (
 submission_id uuid not null references public.fiscal_guest_submissions(id),
 request_id uuid not null,
 request_hash text not null,
 previous_application jsonb not null,
 created_at timestamptz not null default now(),
 primary key(submission_id,request_id)
);
alter table public.fiscal_guest_application_revisions enable row level security;
revoke all on public.fiscal_guest_application_revisions from public,anon,authenticated;
grant select,insert on public.fiscal_guest_application_revisions to service_role;

create function public.read_fiscal_guest_application(p_reference uuid,p_key_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.fiscal_sponsorship_applications%rowtype; answers jsonb;
begin
 if not public.fiscal_guest_application_access(p_reference,p_key_hash) then return null; end if;
 select app.* into a from public.fiscal_sponsorship_applications app
 join public.fiscal_guest_submissions s on s.application_id=app.id where s.id=p_reference;
 if not found then return null; end if;
 -- Only editable answers leave this boundary; no internal metadata, actor IDs or snapshots.
 if a.status='needs_info' then
  select jsonb_object_agg(key,value) into answers from jsonb_each(to_jsonb(a))
   where key=any(public.fiscal_guest_editable_fields());
  answers:=answers||jsonb_build_object('fundraising_goal',a.metadata->'fundraisingGoal');
 end if;
 return jsonb_build_object('reference',p_reference,'projectName',a.project_name,'status',a.status,
  'reviewNote',case when a.status in ('needs_info','declined') then a.review_notes else null end,
  'version',md5(to_jsonb(a)::text),'application',answers);
end $$;

create function public.resubmit_fiscal_guest_application(
 p_reference uuid,p_key_hash text,p_request_id uuid,p_version text,p_application jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.fiscal_guest_submissions%rowtype; a public.fiscal_sponsorship_applications%rowtype;
 r public.fiscal_guest_application_revisions%rowtype; assignments text; item record;
 request_hash text:=md5(jsonb_build_object('version',p_version,'application',p_application)::text);
begin
 if p_request_id is null or p_version is null or p_version !~ '^[a-f0-9]{32}$'
 or p_application is null or jsonb_typeof(p_application)<>'object' or octet_length(p_application::text)>65536
 then raise exception 'Invalid correction' using errcode='22023'; end if;
 select * into s from public.fiscal_guest_submissions where id=p_reference for update;
 if not found or not public.fiscal_guest_application_access(p_reference,p_key_hash) then return null; end if;
 select * into r from public.fiscal_guest_application_revisions where submission_id=s.id and request_id=p_request_id;
 if found then
  if r.request_hash<>request_hash then return jsonb_build_object('state','conflict'); end if;
  return jsonb_build_object('state','submitted');
 end if;
 select * into a from public.fiscal_sponsorship_applications where id=s.application_id for update;
 if a.status<>'needs_info' or md5(to_jsonb(a)::text)<>p_version then return jsonb_build_object('state','conflict'); end if;
 -- Contact identity stays bound to the verified email; a correction cannot transfer access.
 if p_application->>'primary_email' is distinct from s.contact_email then
  return jsonb_build_object('state','email_change'); end if;
 if exists(select 1 from jsonb_object_keys(p_application) k
  where k<>all(public.fiscal_guest_editable_fields()) and k<>'fundraising_goal') then
  raise exception 'Unexpected correction field' using errcode='22023'; end if;
 if exists(select 1 from unnest(public.fiscal_guest_editable_fields()) k where not p_application ? k)
 then raise exception 'Missing correction field' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_application) loop
  if item.key not in ('fundraising_goal','estimated_budget_cents','legal_entity_has_501c3',
    'operates_outside_united_states','engages_in_lobbying','has_legal_compliance_financial_concerns')
    and (jsonb_typeof(item.value) not in ('null','string') or length(item.value#>>'{}')>6000)
  then raise exception 'Invalid correction field' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from unnest(array['applicant_first_name','applicant_last_name','mailing_street_address',
  'mailing_city','mailing_state','mailing_postal_code','project_name','project_description','public_benefit',
  'prospective_funding_sources']) k where nullif(btrim(p_application->>k),'') is null)
 or p_application->>'legal_entity_type' is null
 or p_application->>'project_duration_type' not in ('temporary','ongoing_multi_year')
 or p_application->>'project_duration_type' is null
 or (p_application->>'legal_entity_type'<>'individual' and nullif(btrim(p_application->>'formation_status'),'') is null)
 then raise exception 'Incomplete correction' using errcode='22023'; end if;
 if exists(select 1 from unnest(array['operates_outside_united_states','engages_in_lobbying',
  'has_legal_compliance_financial_concerns']) k where jsonb_typeof(p_application->k) is distinct from 'boolean')
 or ((p_application->>'operates_outside_united_states'='true' or p_application->>'engages_in_lobbying'='true'
  or p_application->>'has_legal_compliance_financial_concerns'='true') and nullif(btrim(p_application->>'concerns_explanation'),'') is null)
 or (p_application->>'project_duration_type'='temporary' and nullif(p_application->>'temporary_start_date','') is null)
 then raise exception 'Incomplete explanation or dates' using errcode='22023'; end if;
 if jsonb_typeof(p_application->'fundraising_goal'->'amountCents') is distinct from 'number'
 or coalesce(p_application->'fundraising_goal'->>'period','') not in ('monthly','annually','total')
 then raise exception 'Invalid fundraising goal' using errcode='22023'; end if;
 if (p_application->'fundraising_goal'->>'amountCents')::numeric<=0
 or (p_application->'fundraising_goal'->>'amountCents')::numeric>9007199254740991
 or mod((p_application->'fundraising_goal'->>'amountCents')::numeric,1)<>0
 or (p_application->>'estimated_budget_cents')::numeric is distinct from (p_application->'fundraising_goal'->>'amountCents')::numeric
 then raise exception 'Invalid fundraising amount' using errcode='22023'; end if;
 insert into public.fiscal_guest_application_revisions(submission_id,request_id,request_hash,previous_application)
 values(s.id,p_request_id,request_hash,to_jsonb(a));
 -- Column names come only from the fixed allowlist, never caller text.
 select string_agg(format('%I = incoming.%I',k,k),',') into assignments
 from unnest(public.fiscal_guest_editable_fields()) k;
 execute 'update public.fiscal_sponsorship_applications as app set '||assignments||
  ', status=''submitted'', submitted_at=now(), review_notes=null, reviewed_by=null, reviewed_at=null, updated_by=null,
   metadata=app.metadata||jsonb_build_object(''fundraisingGoal'',$1->''fundraising_goal''), updated_at=now()
   from jsonb_populate_record(null::public.fiscal_sponsorship_applications,$1) incoming where app.id=$2'
 using p_application,a.id;
 update public.organization_projects set name=p_application->>'project_name' where id=s.project_id;
 insert into public.fiscal_sponsorship_events(org_id,project_id,application_id,event_type,actor_id,summary,metadata)
 values(a.org_id,a.project_id,a.id,'application_submitted',null,'Guest applicant resubmitted requested corrections.',
  jsonb_build_object('submission_id',s.id,'request_id',p_request_id,'previousStatus','needs_info'));
 return jsonb_build_object('state','submitted');
end $$;
revoke all on function public.fiscal_guest_editable_fields(),public.fiscal_guest_application_access(uuid,text),
 public.read_fiscal_guest_application(uuid,text),public.resubmit_fiscal_guest_application(uuid,text,uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.fiscal_guest_editable_fields(),public.fiscal_guest_application_access(uuid,text),
 public.read_fiscal_guest_application(uuid,text),public.resubmit_fiscal_guest_application(uuid,text,uuid,text,jsonb) to service_role;
