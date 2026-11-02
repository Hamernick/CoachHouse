-- Canonical fiscal document writes join closure; signing/provider admission is separate.
begin;
create function public.guard_fiscal_document_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid; actor_key text;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' then
   if new.org_id is distinct from old.org_id or new.id is distinct from old.id
     or new.project_id is distinct from old.project_id or new.application_id is distinct from old.application_id then
     raise exception 'Fiscal document identity cannot change' using errcode='42501'; end if;
   -- Only the exact FK cleanup may bypass admission. Existing immutable-evidence
   -- triggers still run and retain their stricter restrictions.
   foreach actor_key in array array['generated_by','uploaded_by','reviewed_by','confirmed_by'] loop
     if pg_trigger_depth()>1 and to_jsonb(old)->>actor_key is not null and to_jsonb(new)->>actor_key is null
       and (to_jsonb(old)-array[actor_key,'updated_at'])=(to_jsonb(new)-array[actor_key,'updated_at'])
       and not exists(select 1 from public.profiles where id=(to_jsonb(old)->>actor_key)::uuid) then return new; end if;
   end loop;
   -- Historical asset references have independent FKs, not a composite scope FK.
   -- Deleting an otherwise-authorized asset must not erase the document or let
   -- a legacy cross-organization reference block the other organization's work.
   if pg_trigger_depth()>1 and old.asset_id is not null and new.asset_id is null
     and (to_jsonb(old)-array['asset_id','updated_at'])=(to_jsonb(new)-array['asset_id','updated_at'])
     and not exists(select 1 from public.organization_project_assets where id=old.asset_id) then return new; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 -- Application/project deletion is not an escape from the organization fence.
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_fiscal_document_closure() from public,anon,authenticated,service_role;
create trigger fiscal_document_closure before insert or update or delete on public.fiscal_sponsorship_documents
 for each row execute function public.guard_fiscal_document_closure();
comment on function public.guard_fiscal_document_closure() is
 'Serializes fiscal document writes with closure, preserving exact FK cleanup and existing immutable evidence, policies and atomic transitions. No read, purge, provider or lifecycle authority.';
commit;
