do $$
declare
  org uuid := '00000000-0000-0000-0000-000000000001';
  revision uuid := gen_random_uuid();
  identity jsonb;
  stamp timestamptz;
  next_stamp timestamptz;
  before_profile jsonb;
  caught boolean;
begin
  identity := jsonb_build_object('version',1,'revision',revision,'draft',jsonb_build_object('purpose','Internal campaign'), 'assets','{}'::jsonb);
  select updated_at,profile into stamp,before_profile from public.organizations where user_id=org;
  perform set_config('request.jwt.claim.sub',org::text,true);
  set local role authenticated;
  perform public.save_organization_profile_with_brand_kit(org,stamp,null,identity,jsonb_build_object('profile',before_profile,'ein','12-1234567'));
  if (select k.identity->'draft'->>'purpose' from public.organization_brand_kits k where org_id=org) is distinct from 'Internal campaign' then raise exception 'Kit did not save'; end if;
  if (select profile ? 'brandIdentity' from public.organizations where user_id=org) then raise exception 'Private kit leaked into public profile'; end if;
  if (select ein from public.organizations where user_id=org) <> '12-1234567' then raise exception 'Profile did not save atomically'; end if;
  select updated_at into next_stamp from public.organizations where user_id=org;
  caught:=false;
  begin
    perform public.save_organization_profile_with_brand_kit(org,stamp,revision,identity,jsonb_build_object('profile','{}'::jsonb));
  exception when serialization_failure then caught:=true; end;
  if not caught then raise exception 'Stale organization revision accepted'; end if;
  caught:=false;
  begin
    perform public.save_organization_profile_with_brand_kit(org,next_stamp,null,identity,jsonb_build_object('profile','{}'::jsonb));
  exception when serialization_failure then caught:=true; end;
  if not caught then raise exception 'Stale kit revision accepted'; end if;
  caught:=false;
  begin
    perform public.save_organization_profile_with_brand_kit(org,next_stamp,revision,
      jsonb_set(identity,'{assets}',jsonb_build_object('primary-logo',jsonb_build_object('fileId',gen_random_uuid()))),
      jsonb_build_object('profile','{"should_not_save":true}'::jsonb));
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'Unavailable file accepted'; end if;
  if (select profile from public.organizations where user_id=org) is distinct from before_profile then raise exception 'Failed save changed profile'; end if;
  reset role;
end $$;

do $$ declare caught boolean := false; begin
  set local role anon;
  begin perform 1 from public.organization_brand_kits;
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'Anonymous access allowed'; end if;
  reset role;
end $$;

do $$ declare caught boolean := false; stamp timestamptz; begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  set local role authenticated;
  -- Existing fixture user 3 is a board member: read allowed, writes forbidden.
  if not exists(select 1 from public.organization_brand_kits where org_id='00000000-0000-0000-0000-000000000001') then raise exception 'Board cannot read kit'; end if;
  select updated_at into stamp from public.organizations where user_id='00000000-0000-0000-0000-000000000001';
  begin perform public.save_organization_profile_with_brand_kit('00000000-0000-0000-0000-000000000001',stamp,null,'{}','{}');
  exception when insufficient_privilege then caught:=true; end;
  if not caught then raise exception 'Board write allowed'; end if;
  reset role;
end $$;

do $$ begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  set local role authenticated;
  if exists(select 1 from public.organization_brand_kits) then raise exception 'Another organization can read private kit'; end if;
  reset role;
end $$;

do $$ declare stamp timestamptz; identity jsonb; revision uuid; begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  set local role authenticated;
  select updated_at into stamp from public.organizations where user_id='00000000-0000-0000-0000-000000000001';
  select k.identity,(k.identity->>'revision')::uuid into identity,revision from public.organization_brand_kits k where org_id='00000000-0000-0000-0000-000000000001';
  perform public.save_organization_profile_with_brand_kit('00000000-0000-0000-0000-000000000001',stamp,revision,
    jsonb_set(identity,'{revision}',to_jsonb(gen_random_uuid())),jsonb_build_object('profile',(select profile from public.organizations where user_id='00000000-0000-0000-0000-000000000001') || jsonb_build_object('staff_saved',true)));
  reset role;
  if not (select profile ? 'staff_saved' from public.organizations where user_id='00000000-0000-0000-0000-000000000001') then raise exception 'Staff save failed'; end if;
end $$;
