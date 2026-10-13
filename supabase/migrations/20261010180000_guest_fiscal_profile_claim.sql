-- Optional account linkage never moves the internal project or grants Workspace.
create table public.fiscal_guest_profile_imports (
  submission_id uuid primary key references public.fiscal_guest_submissions(id),
  user_id uuid not null references public.profiles(id),
  request_id uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.fiscal_guest_profile_imports enable row level security;
revoke all on public.fiscal_guest_profile_imports from public, anon, authenticated;
grant select, insert on public.fiscal_guest_profile_imports to service_role;

create function public.fiscal_guest_profile_access(p_reference uuid, p_key_hash text, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.fiscal_guest_submissions s
    join public.fiscal_guest_verified_sessions v on v.submission_id=s.id
    join auth.users u on u.id=p_user_id
    where s.id=p_reference and v.key_hash=p_key_hash and v.expires_at>now()
      and s.email_verified_at is not null and u.email_confirmed_at is not null
      and lower(btrim(u.email))=lower(btrim(s.contact_email))
      and (s.claimed_user_id is null or s.claimed_user_id=p_user_id)
      and exists(select 1 from public.profiles p where p.id=u.id)
      -- The configured internal host is never an applicant profile destination.
      and not exists(select 1 from public.fiscal_guest_intake_settings c where c.org_id=p_user_id)
  );
$$;

create function public.preview_fiscal_guest_profile(p_reference uuid,p_key_hash text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_submission public.fiscal_guest_submissions%rowtype; v_profile jsonb; v_public boolean; v_suggestions jsonb;
begin
  if not public.fiscal_guest_profile_access(p_reference,p_key_hash,p_user_id) then return null; end if;
  select * into v_submission from public.fiscal_guest_submissions where id=p_reference;
  if v_submission.claimed_user_id is not null then return jsonb_build_object('state','linked'); end if;
  select profile,is_public into v_profile,v_public from public.organizations where user_id=p_user_id;
  select jsonb_build_object('name',a.project_name,'description',a.project_description,
    'email',a.primary_email,'phone',coalesce(a.phone_number,'')) into v_suggestions
    from public.fiscal_sponsorship_applications a where a.id=v_submission.application_id;
  return jsonb_build_object('state','preview','isPublic',coalesce(v_public,false),
    'version',md5(coalesce(v_profile::text,'missing')),'suggestions',v_suggestions,
    'current',jsonb_build_object('name',coalesce(v_profile->>'name',''),
      'description',coalesce(v_profile->>'description',''),'email',coalesce(v_profile->>'email',''),
      'phone',coalesce(v_profile->>'phone','')));
end $$;

create function public.save_fiscal_guest_profile(
  p_reference uuid,p_key_hash text,p_user_id uuid,p_request_id uuid,p_version text,p_fields jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.fiscal_guest_submissions%rowtype;
  v_import public.fiscal_guest_profile_imports%rowtype;
  v_profile jsonb; v_public boolean; v_exists boolean; v_field record;
  v_hash text:=md5(jsonb_build_object('version',p_version,'fields',p_fields)::text);
begin
  if p_request_id is null or p_version is null or p_version !~ '^[a-f0-9]{32}$'
    or p_fields is null or jsonb_typeof(p_fields)<>'object' then raise exception 'Invalid profile selection' using errcode='22023'; end if;
  for v_field in select key,value from jsonb_each(p_fields) loop
    if v_field.key not in ('name','description','email','phone') or jsonb_typeof(v_field.value)<>'string'
      or length(v_field.value#>>'{}')>(case when v_field.key='description' then 6000 when v_field.key='email' then 254 else 200 end)
      or (v_field.value#>>'{}') ~ '[<>]' then raise exception 'Invalid profile selection' using errcode='22023'; end if;
    if v_field.key='name' and btrim(v_field.value#>>'{}')='' then raise exception 'Organization name required' using errcode='22023'; end if;
  end loop;
  select * into v_submission from public.fiscal_guest_submissions where id=p_reference for update;
  if not found or not public.fiscal_guest_profile_access(p_reference,p_key_hash,p_user_id) then return null; end if;
  select * into v_import from public.fiscal_guest_profile_imports where submission_id=p_reference;
  if found then
    if v_import.user_id=p_user_id and v_import.request_id=p_request_id and v_import.request_hash=v_hash then
      return jsonb_build_object('state','linked');
    end if;
    return jsonb_build_object('state','already_linked');
  end if;
  if v_submission.claimed_user_id is not null then return jsonb_build_object('state','already_linked'); end if;
  -- Serialize creation and imports from different applications for this owner.
  perform pg_advisory_xact_lock(hashtextextended('fiscal-profile:'||p_user_id::text,0));
  select profile,is_public into v_profile,v_public from public.organizations where user_id=p_user_id for update;
  v_exists:=found;
  if md5(coalesce(v_profile::text,'missing'))<>p_version then return jsonb_build_object('state','conflict'); end if;
  -- A public profile can link its application, but cannot receive private answers.
  if coalesce(v_public,false) and p_fields<>'{}'::jsonb then return jsonb_build_object('state','public_profile'); end if;
  if not v_exists then
    insert into public.organizations(user_id,profile,is_public) values(p_user_id,p_fields,false)
      on conflict(user_id) do nothing;
    if not found then return jsonb_build_object('state','conflict'); end if;
  elsif p_fields<>'{}'::jsonb then
    update public.organizations set profile=coalesce(profile,'{}'::jsonb)||p_fields where user_id=p_user_id;
  end if;
  update public.fiscal_guest_submissions set claimed_user_id=p_user_id,claimed_org_id=p_user_id,claimed_at=now()
    where id=p_reference;
  insert into public.fiscal_guest_profile_imports(submission_id,user_id,request_id,request_hash)
    values(p_reference,p_user_id,p_request_id,v_hash);
  return jsonb_build_object('state','linked');
end $$;

revoke all on function public.fiscal_guest_profile_access(uuid,text,uuid),
  public.preview_fiscal_guest_profile(uuid,text,uuid),public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.fiscal_guest_profile_access(uuid,text,uuid),
  public.preview_fiscal_guest_profile(uuid,text,uuid),public.save_fiscal_guest_profile(uuid,text,uuid,uuid,text,jsonb)
  to service_role;
