do $$
declare changed integer;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 if public.has_workspace_paid_features(auth.uid()) then raise exception 'Free org was paid'; end if;
 if not exists (select 1 from storage.objects where bucket_id='org-documents') then raise exception 'Existing documents unreadable'; end if;
 begin
  insert into storage.objects (bucket_id,name) values ('org-documents',auth.uid()::text||'/new.pdf');
  raise exception 'Free upload allowed';
 exception when insufficient_privilege then null; end;
 update storage.objects set name=auth.uid()::text||'/changed.pdf' where bucket_id='org-documents';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Free storage edit allowed'; end if;
 delete from storage.objects where bucket_id='org-documents';
 get diagnostics changed = row_count;
 if changed <> 0 then raise exception 'Free storage deletion allowed'; end if;
 begin
  insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
   values(auth.uid(),auth.uid()::text||'/native.pdf','Native','application/pdf',1,auth.uid());
  raise exception 'Free metadata write allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.organization_workspace_invites(org_id) values(auth.uid());
  raise exception 'Free temporary invitation allowed';
 exception when insufficient_privilege then null; end;
 update public.organization_workspace_invites set revoked_at=now() where org_id=auth.uid();
 get diagnostics changed = row_count;
 if changed <> 1 then raise exception 'Free user cannot revoke invitation'; end if;
 -- Normalized empty document fields from the profile form are not new documents.
 update public.organizations set profile=profile||'{"documents":{"bylaws":null}}' where user_id=auth.uid();
 -- Profile fields and Drive source metadata remain writable without touching a native body.
 update public.organizations set profile=jsonb_set(profile,'{name}','"New name"') where user_id=auth.uid();
 update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,driveSource}','{"fileId":"drive-file"}') where user_id=auth.uid();
 begin
  update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,content}','"Changed"') where user_id=auth.uid();
  raise exception 'Free roadmap edit allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.organizations set profile=profile||'{"documents":{"bylaws":{"name":"Native"}}}' where user_id=auth.uid();
  raise exception 'Free native document write allowed';
 exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values('org-media',auth.uid()::text||'/avatar.png');
end $$;
-- A paid viewer does not grant paid access to a different organization.
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id)
 values('00000000-0000-0000-0000-000000000002','active','{"plan_tier":"organization"}','sub_other');
do $$ begin
 if public.has_workspace_paid_features('00000000-0000-0000-0000-000000000001') then raise exception 'Cross-org entitlement leaked'; end if;
end $$;
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id)
 values('00000000-0000-0000-0000-000000000001','trialing','{"plan_tier":"organization"}','sub_paid');
do $$ begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 set local role authenticated;
 if not public.has_workspace_paid_features(auth.uid()) then raise exception 'Trial denied'; end if;
 insert into storage.objects(bucket_id,name) values('org-documents',auth.uid()::text||'/paid.pdf');
 insert into public.organization_document_files(org_id,storage_path,name,mime_type,size_bytes,created_by)
  values(auth.uid(),auth.uid()::text||'/paid.pdf','Paid','application/pdf',1,auth.uid());
 insert into public.organization_workspace_invites(org_id) values(auth.uid());
 update public.organizations set profile=jsonb_set(profile,'{roadmap,sections,0,content}','"Paid edit"') where user_id=auth.uid();
end $$;
update public.subscriptions set status='canceled' where stripe_subscription_id='sub_paid';
do $$ begin
 if public.has_workspace_paid_features('00000000-0000-0000-0000-000000000001') then raise exception 'Canceled subscription allowed'; end if;
end $$;
insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id,created_at)
 values('00000000-0000-0000-0000-000000000001','active','{"plan_tier":"organization"}','stub_preview',now()+interval '1 hour');
do $$ begin
 if public.has_workspace_paid_features('00000000-0000-0000-0000-000000000001') then raise exception 'Stub subscription allowed'; end if;
end $$;
