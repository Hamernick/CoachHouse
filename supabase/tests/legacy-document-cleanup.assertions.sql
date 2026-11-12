create function pg_temp.expect_cleanup_denial(statement text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected cleanup denial: %',statement;
exception when insufficient_privilege then null;
end $$;

do $$
declare org uuid:='00000000-0000-0000-0000-000000000001'; file uuid; original text; outgoing text; current_path text;
  bytes bigint; total bigint; receipt jsonb; before_profile jsonb;
begin
  select id,storage_path into strict file,original from public.organization_document_files where org_id=org and document_kind='w9';
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',org)::text,true);
  outgoing:=org::text||'/w9/outgoing.pdf';current_path:=org::text||'/w9/current.pdf';
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',outgoing,'name','Outgoing','size',17)) where user_id=org;
  insert into storage.objects(bucket_id,name) values('org-documents',outgoing);
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',current_path,'name','Current','size',17)) where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=file and storage_path=current_path and size_bytes=17),'Replacement changed identity';
  assert exists(select 1 from public.legacy_document_cleanup where storage_path=outgoing and size_bytes=17 and completed_at is null),'Replacement lost outgoing bytes';
  assert public.document_retained_source_bytes(org)>=17,'Outgoing bytes omitted from quota';
  perform pg_temp.expect_cleanup_denial(format('delete from storage.objects where name=%L',outgoing));
  receipt:=public.reserve_legacy_document_cleanup(org,'w9',org,false);
  assert receipt @> jsonb_build_array(jsonb_build_object('path',outgoing,'fileId',file,'kind','w9')),'Exact outgoing object missing';
  assert not public.finish_legacy_document_cleanup(org,outgoing,org,false),'Released quota with Storage present';
  perform pg_temp.expect_cleanup_denial(format('update public.organizations set profile=jsonb_set(profile,''{documents,w9}'',%L::jsonb) where user_id=%L',jsonb_build_object('path',outgoing,'name','Stale','size',17)::text,org));
  perform pg_temp.expect_cleanup_denial(format('update public.organizations set profile=profile||jsonb_build_object(''old_link'',%L) where user_id=%L',outgoing,org));
  perform pg_temp.expect_cleanup_denial(format('update storage.objects set name=%L where name=%L',org::text||'/w9/escaped.pdf',outgoing));

  -- Revocation between reservation and Storage/finalization keeps the receipt.
  perform set_config('fixture.folder_denied','true',true);
  perform pg_temp.expect_cleanup_denial(format('delete from storage.objects where name=%L',outgoing));
  perform pg_temp.expect_cleanup_denial(format('select public.finish_legacy_document_cleanup(%L,%L,%L,false)',org,outgoing,org));
  assert public.reserve_legacy_document_cleanup(org,'w9',org,false)='[]'::jsonb,'Revoked folder disclosed queue';
  perform set_config('fixture.folder_denied','false',true);
  delete from storage.objects where name=outgoing;
  assert public.finish_legacy_document_cleanup(org,outgoing,org,false),'Cleanup did not finish';
  assert public.finish_legacy_document_cleanup(org,outgoing,org,false),'Lost reply retry was not idempotent';
  assert exists(select 1 from public.organization_document_files where id=file and storage_path=current_path and size_bytes=17),'Old cleanup changed replacement';
  perform pg_temp.expect_cleanup_denial(format('insert into storage.objects(bucket_id,name) values(''org-documents'',%L)',outgoing));
  -- Unclaimed references defer deletion, including unrelated profile links.
  update public.organizations set profile=profile||jsonb_build_object('retained_link',current_path) where user_id=org;
  update public.organizations set profile=profile#-'{documents,w9}' where user_id=org;
  receipt:=public.reserve_legacy_document_cleanup(org,'w9',org,false);
  assert not receipt @> jsonb_build_array(jsonb_build_object('path',current_path)),'Referenced path admitted';
  assert exists(select 1 from public.organization_document_files where id=file and deleted_at is not null and size_bytes=17),'Delete lost identity/quota';
  update public.organizations set profile=profile-'retained_link' where user_id=org;
  receipt:=public.reserve_legacy_document_cleanup(org,'w9',org,false);
  assert receipt @> jsonb_build_array(jsonb_build_object('path',current_path)),'Retired path not retryable';
  assert public.finish_legacy_document_cleanup(org,current_path,org,false),'Missing object did not finish';
  assert exists(select 1 from public.organization_document_files where id=file and size_bytes=0 and deleted_at is not null),'Retirement cleanup lost identity';

  -- Drain initial absent fixture paths before a precise quota boundary test.
  for receipt in select jsonb_array_elements(public.reserve_legacy_document_cleanup(org,null,org,false)) loop
    assert public.finish_legacy_document_cleanup(org,receipt->>'path',org,false);end loop;
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/quota-old.pdf','name','At cap','size',17)) where user_id=org;
  select coalesce(sum(size_bytes),0)+public.document_retained_source_bytes(org) into total from public.organization_document_files where org_id=org;
  bytes:=5368709120-total;
  for i in 1..ceil(bytes::numeric/52428800)::integer loop
    insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
      values(org,org::text||'/library/cleanup-cap-'||i,'Capacity','application/octet-stream',least(bytes,52428800),org);
    bytes:=bytes-least(bytes,52428800);
  end loop;
  select profile into before_profile from public.organizations where user_id=org;
  begin
    update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/quota-new.pdf','name','Replacement','size',17)) where user_id=org;
    raise exception 'Same-size replacement bypassed outstanding-byte quota';
  exception when check_violation then
    assert sqlerrm like 'Organization document storage quota exceeded%';
  end;
  assert (select profile=before_profile from public.organizations where user_id=org),'Quota failure partially committed';
  assert not exists(select 1 from public.legacy_document_cleanup where storage_path=org::text||'/w9/quota-old.pdf'),'Rolled-back replacement left cleanup receipt';
  update public.organizations set profile=jsonb_set(profile,'{documents,w9,name}','"Rename at cap"') where user_id=org;
  delete from public.organization_document_files where storage_path like org::text||'/library/cleanup-cap-%';

  -- Policy deletion can be retried by a later write after its profile ID is gone.
  update public.organizations set profile=jsonb_set(profile,'{policies}',coalesce(profile->'policies','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'id','cleanup-policy','title','Cleanup','document',jsonb_build_object('path',org::text||'/policies/cleanup-policy/a.pdf','name','Policy','size',5)))) where user_id=org;
  update public.organizations set profile=jsonb_set(profile,'{policies}',coalesce((select jsonb_agg(p) from jsonb_array_elements(profile->'policies') p where p->>'id'<>'cleanup-policy'),'[]'::jsonb)) where user_id=org;
  receipt:=public.reserve_legacy_document_cleanup(org,null,org,false);
  assert receipt @> jsonb_build_array(jsonb_build_object('kind','policy:cleanup-policy')),'Deleted policy stranded cleanup';

  -- Paid-org support keeps its explicitly reserved context; revocation still wins.
  insert into public.platform_staff_members(user_id,access_level) values('00000000-0000-0000-0000-000000000003','coach');
  insert into public.workspace_support_grants(user_id) values('00000000-0000-0000-0000-000000000003');
  outgoing:=org::text||'/w9/support-old.pdf';
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',outgoing,'name','Support','size',3)) where user_id=org;
  insert into storage.objects(bucket_id,name) values('org-documents',outgoing);
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',org::text||'/w9/support-new.pdf','name','New','size',3)) where user_id=org;
  perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id','00000000-0000-0000-0000-000000000003')::text,true);
  receipt:=public.reserve_legacy_document_cleanup(org,'w9','00000000-0000-0000-0000-000000000003',true);
  assert receipt @> jsonb_build_array(jsonb_build_object('path',outgoing));
  update public.workspace_support_grants set revoked_at=now();
  perform pg_temp.expect_cleanup_denial(format('delete from storage.objects where name=%L',outgoing));
  update public.workspace_support_grants set revoked_at=null;
  delete from storage.objects where name=outgoing;
  assert public.finish_legacy_document_cleanup(org,outgoing,'00000000-0000-0000-0000-000000000003',true),'Paid-org support cleanup failed';
  delete from public.workspace_support_grants;
  delete from public.platform_staff_members;
  perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',org)::text,true);

  assert not has_table_privilege('authenticated','public.legacy_document_cleanup','select,insert,update,delete'),'Client ledger exposed';
  assert not has_table_privilege('service_role','public.legacy_document_cleanup','insert,update,delete'),'Service bypassed owner';
  assert not has_function_privilege('authenticated','public.reserve_legacy_document_cleanup(uuid,text,uuid,boolean)','execute'),'Client RPC exposed';
  assert not has_function_privilege('anon','public.finish_legacy_document_cleanup(uuid,text,uuid,boolean)','execute'),'Anonymous finish exposed';
  perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id','00000000-0000-0000-0000-000000000003')::text,true);
  perform pg_temp.expect_cleanup_denial(format('select public.reserve_legacy_document_cleanup(%L,null,%L,false)',org,org));
  perform pg_temp.expect_cleanup_denial(format('select public.reserve_legacy_document_cleanup(%L,null,%L,false)',org,'00000000-0000-0000-0000-000000000003'));
  perform set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',org)::text,true);
  update public.subscriptions set status='canceled' where user_id=org;
  perform pg_temp.expect_cleanup_denial(format('select public.reserve_legacy_document_cleanup(%L,null,%L,false)',org,org));
  update public.subscriptions set status='active' where stripe_subscription_id='core_upload_fixture';
  insert into public.organization_closures values(org,'closing');
  perform pg_temp.expect_cleanup_denial(format('select public.reserve_legacy_document_cleanup(%L,null,%L,false)',org,org));
  delete from public.organization_closures where org_id=org;
end $$;
