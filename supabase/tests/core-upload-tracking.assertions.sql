do $test$
declare org uuid:='00000000-0000-0000-0000-000000000001'; retained uuid:='11000000-0000-4000-8000-000000000001';
 before_profile jsonb; before_file jsonb; before_ctid text; remaining bigint; n integer:=0; bad jsonb; role_name text;
begin
 if exists(select 1 from public.organization_document_files where org_id='11000000-0000-4000-8000-000000000004') then
   raise exception 'Backfill changed a closing organization';end if;
 if (select id from public.organization_document_files where org_id=org and document_kind='w9')<>retained
   or (select name from public.organization_document_files where id=retained)<>'Backfilled title'
   or not exists(select 1 from public.organization_document_files where org_id=org and document_kind='bylaws')
   or exists(select 1 from public.organization_document_files where org_id=org and document_kind='einConfirmationLetter') then
   raise exception 'Backfill changed identity, lost a source or registered a seed';end if;
 select ctid::text,to_jsonb(f) into before_ctid,before_file from public.organization_document_files f where id=retained;
 update public.organizations set profile=profile||'{"unrelated":"keep"}' where user_id=org;
 if (select ctid::text from public.organization_document_files where id=retained)<>before_ctid then raise exception 'Unrelated save rewrote file';end if;
 update public.organizations set profile=jsonb_set(profile,'{documents,w9,name}','"Renamed"') where user_id=org;
 if not exists(select 1 from public.organization_document_files where id=retained and name='Renamed' and size_bytes=10) then raise exception 'Rename not atomic';end if;
 update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/replacement.pdf','name','Replacement','size',15)) where user_id=org;
 if not exists(select 1 from public.organization_document_files where id=retained and storage_path=org::text||'/w9/replacement.pdf' and size_bytes=15) then raise exception 'Replacement lost identity';end if;
 select profile into before_profile from public.organizations where user_id=org;
 select to_jsonb(f) into before_file from public.organization_document_files f where id=retained;
 foreach bad in array array['false'::jsonb,jsonb_build_object('path','foreign/w9/a.pdf'),jsonb_build_object('path',org::text||'/w9/../a.pdf'),jsonb_build_object('path',org::text||'/w9/')] loop
  begin
   update public.organizations set profile=jsonb_set(profile,'{documents,w9}',bad) where user_id=org;
   raise exception 'Invalid source admitted';
  exception when check_violation then
   if sqlerrm<>'Invalid organization document source.' then raise;end if;
  end;
  if (select profile from public.organizations where user_id=org)<>before_profile or
    (select to_jsonb(f) from public.organization_document_files f where id=retained)<>before_file then raise exception 'Failed save changed canonical data';end if;
 end loop;
 -- Fill the existing physical-byte quota; replacements must exclude their own
 -- slot, and a rejected replacement must roll back both profile and file row.
 select 5368709120-coalesce(sum(size_bytes),0) into remaining from public.organization_document_files where org_id=org;
 while remaining>0 loop
  n:=n+1;
  insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
   values(org,org::text||'/library/core-quota-'||n,'Quota','application/pdf',least(remaining,52428800),org);
  remaining:=remaining-least(remaining,52428800);
 end loop;
 begin
  update public.organizations set profile=jsonb_set(profile,'{documents,w9,size}','16') where user_id=org;
  raise exception 'Replacement bypassed quota';
 exception when check_violation then
  if sqlerrm<>'Organization document storage quota exceeded.' then raise;end if;
 end;
 if (select profile from public.organizations where user_id=org)<>before_profile or
   (select to_jsonb(f) from public.organization_document_files f where id=retained)<>before_file then raise exception 'Quota failure partially committed';end if;
 update public.organizations set profile=jsonb_set(profile,'{documents,w9,name}','"At cap"') where user_id=org;
 if (select name from public.organization_document_files where id=retained)<>'At cap' then raise exception 'Same-size rename at cap failed';end if;
 update public.organizations set profile=profile#-'{documents,w9}' where user_id=org;
 if not exists(select 1 from public.organization_document_files where id=retained and size_bytes=15) then raise exception 'Metadata removal erased unconfirmed bytes or identity';end if;
 delete from public.organization_document_files where org_id=org and storage_path like org::text||'/library/core-quota-%';
 foreach role_name in array array['anon','authenticated','service_role'] loop
  if has_function_privilege(role_name,'public.sync_organization_core_document_files(uuid,jsonb)','execute') or
    has_function_privilege(role_name,'public.track_organization_core_document_files()','execute') then raise exception 'Private synchronization callable by %',role_name;end if;
 end loop;
 perform set_config('fixture.closure_cleanup','true',true);
 update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/cleanup.pdf','name','Closure cleanup','size',1)) where user_id=org;
 if (select storage_path from public.organization_document_files where id=retained)<>org::text||'/w9/replacement.pdf' then raise exception 'Closure finalization rebuilt metadata';end if;
 perform set_config('fixture.closure_cleanup','false',true);
 update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/race-start.pdf','name','Race start','size',10)) where user_id=org;
 update public.subscriptions set status='canceled' where user_id=org;
 perform set_config('request.jwt.claim.sub',org::text,true);
 set local role authenticated;
 begin
  update public.organizations set profile=jsonb_set(profile,'{documents,w9,name}','"Free edit"') where user_id=org;
  raise exception 'New tracking trigger bypassed Free write guard';
 exception when insufficient_privilege then
  if sqlerrm not like 'Upgrade to create or edit Coach House documents%' then raise;end if;
 end;
 if (select name from public.organization_document_files where id=retained)<>'Race start' then raise exception 'Free edit changed tracked metadata';end if;
 reset role;
 update public.subscriptions set status='active' where stripe_subscription_id='core_upload_fixture';
end;
$test$;
