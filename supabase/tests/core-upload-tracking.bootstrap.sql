-- Existing closure finalization is a controlled prerequisite here. Full-schema
-- staging qualification separately verifies the real closure helper and guards.
create function public.closure_asset_profile_finalization_allowed(jsonb,jsonb)
returns boolean language sql stable as $$select coalesce(nullif(current_setting('fixture.closure_cleanup',true),''),'false')::boolean$$;
create table public.organization_closures(org_id uuid primary key,state text not null);
insert into public.profiles(id) values('11000000-0000-4000-8000-000000000004');
set request.jwt.claim.role='service_role';
insert into public.organizations(user_id,profile) values('11000000-0000-4000-8000-000000000004',
 '{"documents":{"w9":{"path":"11000000-0000-4000-8000-000000000004/w9/retained.pdf","name":"Closed retained file","size":1}}}');
reset request.jwt.claim.role;
insert into public.organization_closures values('11000000-0000-4000-8000-000000000004','closing');
create trigger fixture_organization_stamp before update on public.organizations
for each row execute function public.handle_updated_at();
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id,created_at)
values('00000000-0000-0000-0000-000000000001','active','{"plan_tier":"organization"}','core_upload_fixture',now()+interval '2 hours');
insert into public.organization_document_files(id,org_id,document_kind,storage_path,name,mime_type,size_bytes,created_by)
values('11000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000001','w9',
 '00000000-0000-0000-0000-000000000001/w9/before.pdf','Before','application/pdf',10,'00000000-0000-0000-0000-000000000001');
update public.organizations set profile=profile||jsonb_build_object('documents',jsonb_build_object(
 'w9',jsonb_build_object('path',user_id::text||'/w9/before.pdf','name','Backfilled title','size',10),
 'bylaws',jsonb_build_object('path',user_id::text||'/bylaws/first.pdf','name','Bylaws','size',20),
 'einConfirmationLetter',jsonb_build_object('path','seed/ein.pdf','name','Example','size',30)
)) where user_id='00000000-0000-0000-0000-000000000001';
