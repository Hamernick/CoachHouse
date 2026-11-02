-- Private brand drafts are canonical records, independent of public profile edits.
begin;
create function public.guard_brand_kit_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' then
   if new.org_id is distinct from old.org_id then
     raise exception 'Brand kit organization cannot change' using errcode='42501'; end if;
   -- A separately deleted login loses attribution, never the private draft.
   if pg_trigger_depth()>1 and old.updated_by is not null and new.updated_by is null
     and (to_jsonb(old)-'updated_by')=(to_jsonb(new)-'updated_by')
     and not exists(select 1 from auth.users where id=old.updated_by) then return new; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 -- Direct kit writers can own tuples first; the atomic profile/kit RPC owns
 -- organization UPDATE first. NOWAIT rejects the reverse order safely.
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_brand_kit_closure() from public,anon,authenticated,service_role;
create trigger brand_kit_closure before insert or update or delete on public.organization_brand_kits
 for each row execute function public.guard_brand_kit_closure();
comment on function public.guard_brand_kit_closure() is
 'Serializes private brand-kit writes with closure while preserving exact account attribution cleanup. Existing RLS, atomic profile/kit revisions and explicit post-cancel saves remain; no read, provider or lifecycle authority granted.';
commit;
