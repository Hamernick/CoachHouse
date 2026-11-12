create function pg_temp.expect_retirement_denial(statement text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'Expected retirement denial: %',statement;
exception when insufficient_privilege then null;
end $$;

do $$
declare org uuid:='00000000-0000-0000-0000-000000000001'; file uuid; policy_file uuid;
  path text; bytes bigint; replacement text; policy_path text; p jsonb;
begin
  select id,storage_path,size_bytes into strict file,path,bytes from public.organization_document_files
    where org_id=org and document_kind='w9';
  insert into public.fixture_legacy_dependents values(file,'retained source permission');
  insert into storage.objects(bucket_id,name) values('org-documents',path);
  perform pg_temp.expect_retirement_denial(format('delete from public.organization_document_files where id=%L',file));
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set document_kind=null where id=%L',file));
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',file));
  update public.organizations set profile=jsonb_set(profile,'{documents}',(profile->'documents')-'w9') where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=file and deleted_at is not null and size_bytes=bytes),'Removal lost identity or quota';
  assert exists(select 1 from public.fixture_legacy_dependents where file_id=file),'Removal cascaded source authority';
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set deleted_at=null where id=%L',file));
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',file));
  perform pg_temp.expect_retirement_denial(format('update public.organizations set profile=jsonb_set(profile,''{documents,w9}'',%L::jsonb) where user_id=%L',jsonb_build_object('path',org::text||'/w9/premature.pdf','name','Premature','size',1)::text,org));
  assert exists(select 1 from public.organization_document_files where id=file and deleted_at is not null and size_bytes=bytes),'Premature re-upload lost retained bytes';
  delete from storage.objects where bucket_id='org-documents' and name=path;
  update public.organizations set profile=profile||jsonb_build_object('retained_link',path) where user_id=org;
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',file));
  update public.organizations set profile=profile-'retained_link' where user_id=org;
  insert into public.document_file_versions values(path);
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',file));
  delete from public.document_file_versions where storage_path=path;
  insert into public.document_version_operations values(path,'committed');
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',file));
  delete from public.document_version_operations where source_storage_path=path;
  update public.organization_document_files set size_bytes=0 where id=file and deleted_at is not null;
  update public.organization_document_files set size_bytes=0 where id=file and deleted_at is not null;
  assert exists(select 1 from public.organization_document_files where id=file and size_bytes=0 and deleted_at is not null),'Cleanup did not retain tombstone';
  replacement:=org::text||'/w9/re-upload.pdf';
  update public.organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path',replacement,'name','Re-upload','size',9)) where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=file and storage_path=replacement and size_bytes=9 and deleted_at is null),'Re-upload lost identity';
  assert exists(select 1 from public.fixture_legacy_dependents where file_id=file),'Re-upload lost dependent authority';
  update public.organization_document_files set size_bytes=0 where org_id=org and document_kind='w9' and storage_path=path and deleted_at is not null;
  assert exists(select 1 from public.organization_document_files where id=file and size_bytes=9),'Old cleanup changed re-upload';

  policy_path:=org::text||'/policies/retention-policy/document.pdf';
  p:=jsonb_build_object('id','retention-policy','title','Retention policy','document',jsonb_build_object('path',policy_path,'name','Policy','size',11));
  update public.organizations set profile=jsonb_set(profile,'{policies}',coalesce(profile->'policies','[]'::jsonb)||jsonb_build_array(p)) where user_id=org;
  select id into strict policy_file from public.organization_document_files where org_id=org and document_kind='policy:retention-policy';
  insert into public.fixture_legacy_dependents values(policy_file,'policy authority');
  insert into storage.objects(bucket_id,name) values('org-documents',policy_path);
  update public.organizations set profile=jsonb_set(profile,'{policies}',(select jsonb_agg(case when e->>'id'='retention-policy' then e||'{"document":null}'::jsonb else e end) from jsonb_array_elements(profile->'policies') e)) where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=policy_file and deleted_at is not null and size_bytes=11),'Policy removal dropped quota/identity';
  perform pg_temp.expect_retirement_denial(format('update public.organization_document_files set size_bytes=0 where id=%L',policy_file));
  delete from storage.objects where name=policy_path;
  update public.organization_document_files set size_bytes=0 where id=policy_file and deleted_at is not null;
  update public.organizations set profile=jsonb_set(profile,'{policies}',(select jsonb_agg(case when e->>'id'='retention-policy' then p else e end) from jsonb_array_elements(profile->'policies') e)) where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=policy_file and deleted_at is null and size_bytes=11),'Policy reattachment changed identity';
  update public.organizations set profile=jsonb_set(profile,'{policies}',coalesce((select jsonb_agg(e) from jsonb_array_elements(profile->'policies') e where e->>'id'<>'retention-policy'),'[]'::jsonb)) where user_id=org;
  assert exists(select 1 from public.organization_document_files where id=policy_file and deleted_at is not null and size_bytes=11),'Deleting whole policy erased identity';
  update public.organization_document_files set size_bytes=0 where id=policy_file and deleted_at is not null;
  assert exists(select 1 from public.fixture_legacy_dependents where file_id=policy_file),'Policy cleanup cascaded authority';
  assert not has_function_privilege('authenticated','public.guard_legacy_document_retirement()','execute'),'Guard exposed to client';
end $$;

-- Existing owner/member RLS still applies to retirement and quota writes.
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select pg_temp.expect_retirement_denial($q$delete from public.organization_document_files where org_id='00000000-0000-0000-0000-000000000001' and document_kind='w9'$q$);
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$ declare changed integer; begin
 update public.organization_document_files set name='Unauthorized' where document_kind='w9';get diagnostics changed=row_count;
 assert changed=0,'Board member wrote source metadata';
end $$;
reset role;
reset request.jwt.claim.sub;
