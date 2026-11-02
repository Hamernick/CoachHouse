-- Metadata admission for organization-owned Storage mutations, including service
-- callers. Physical provider IO is separate and requires hosted reconciliation.
begin;
create function public.guard_organization_storage_object(p_bucket text,p_name text) returns void
 language plpgsql security definer set search_path='' as $$
declare prefix text; owners uuid[]:='{}'; org uuid;
begin
 if p_bucket not in ('org-documents','project-assets','fiscal-signing','org-media','program-media','roadmap-media') then return; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'Storage closure admission requires read committed isolation' using errcode='40001'; end if;
 prefix:=split_part(p_name,'/',1);
 if prefix ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  select array_agg(user_id) into owners from public.organizations where user_id=prefix::uuid;
 end if;
 -- Legacy fiscal paths remain owned by their actual host associations, not a
 -- linked applicant. Resolve every association; one active alias cannot reopen
 -- an object whose other canonical owner has closed.
 select array_agg(distinct owner_id order by owner_id) into owners from (
  select unnest(coalesce(owners,'{}'::uuid[])) owner_id
  union select org_id from public.fiscal_sponsorship_documents where storage_bucket=p_bucket and storage_path=p_name
  union select org_id from public.organization_project_assets where p_bucket='project-assets' and storage_path=p_name
 ) scopes;
 foreach org in array coalesce(owners,'{}'::uuid[]) loop
  perform public.guard_uploaded_document_organization(org);
 end loop;
 -- No invented ownership for Auth-only personal objects, platform buckets or
 -- unassociated legacy paths. Their original permissions remain; legacy-path
 -- inventory is a separate closure activation gate.
end $$;
revoke all on function public.guard_organization_storage_object(text,text) from public,anon,authenticated,service_role;
create function public.guard_organization_storage_mutation() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('DELETE','UPDATE') then perform public.guard_organization_storage_object(old.bucket_id,old.name); end if;
 if tg_op in ('INSERT','UPDATE') then perform public.guard_organization_storage_object(new.bucket_id,new.name); end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.guard_organization_storage_mutation() from public,anon,authenticated,service_role;
create trigger organization_closure_mutation before insert or update or delete on storage.objects
 for each row execute function public.guard_organization_storage_mutation();

-- Closure-only preflight for already-authorized application cleanup. This does
-- not grant file authority or claim atomicity across a later provider request;
-- the Storage metadata trigger independently rechecks actual admission.
create function public.organization_storage_write_admitted(p_org uuid) returns boolean
 language plpgsql security definer set search_path='' as $$
begin
 perform public.guard_uploaded_document_organization(p_org); return true;
exception when insufficient_privilege or serialization_failure then return false;
end $$;
revoke all on function public.organization_storage_write_admitted(uuid) from public,anon,authenticated,service_role;
grant execute on function public.organization_storage_write_admitted(uuid) to authenticated,service_role;
comment on function public.guard_organization_storage_mutation() is
 'Current organization closure admission for owned Storage metadata insert/update/delete/rename, including service role. Existing RLS, personal/shared ownership and immutable evidence remain. No purge grant, independent suppression store, object deletion atomicity, backup horizon or provider rollback claim.';
commit;
