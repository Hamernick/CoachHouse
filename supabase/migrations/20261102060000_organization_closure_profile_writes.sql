-- Canonical organization-row mutation fence. Closure is still unexposed.
-- Profile JSON owns people, brand, narratives and core-document references;
-- other organization columns include publication/settings metadata. Existing
-- authorization and optimistic revisions remain at their current owners.
begin;
create function public.guard_organization_row_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='INSERT' then org:=new.user_id;
 else
   org:=old.user_id;
   if tg_op='UPDATE' and new.user_id is distinct from org then
     raise exception 'Organization owner cannot change' using errcode='42501'; end if;
 end if;
 -- UPDATE/DELETE already own this tuple, which conflicts with the lifecycle
 -- command's FOR UPDATE. A volatile trigger query observes closure committed
 -- while the statement waited, rather than its original statement snapshot.
 -- INSERT cannot have committed closure without the existing parent row;
 -- conflicting UPSERT also runs this trigger on its UPDATE path after waiting.
 -- No additional downstream lock or owner/response permission is introduced.
 if exists(select 1 from public.organization_closures where org_id=org and state='closing') then
   raise exception 'Organization unavailable' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_organization_row_closure() from public,anon,authenticated,service_role;
create trigger organization_row_closure before insert or update or delete on public.organizations
 for each row execute function public.guard_organization_row_closure();
comment on function public.guard_organization_row_closure() is
 'Canonical organization-row writes deny during closure, including service-role writes, UPSERT and deletion. No purge bypass. Does not fence independent reads, Storage/provider effects or other canonical tables.';
commit;
