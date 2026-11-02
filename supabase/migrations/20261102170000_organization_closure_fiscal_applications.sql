-- Application state and review records are canonical writes independent of files.
begin;
create function public.guard_fiscal_application_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid; identity_key text; actor_key text; actor_keys text[];
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' then
   foreach identity_key in array array['id','org_id','project_id','application_id'] loop
     if to_jsonb(new)->identity_key is distinct from to_jsonb(old)->identity_key then
       raise exception 'Fiscal application/review identity cannot change' using errcode='42501'; end if;
   end loop;
   actor_keys:=case when tg_table_name='fiscal_sponsorship_applications'
     then array['created_by','updated_by','reviewed_by'] else array['reviewed_by'] end;
   -- Separate account deletion may clear exact attribution; trigger depth alone
   -- never authorizes a review, status change, or arbitrary field mutation.
   foreach actor_key in array actor_keys loop
     if pg_trigger_depth()>1 and to_jsonb(old)->>actor_key is not null and to_jsonb(new)->>actor_key is null
       and (to_jsonb(old)-array[actor_key,'updated_at'])=(to_jsonb(new)-array[actor_key,'updated_at'])
       and not exists(select 1 from public.profiles where id=(to_jsonb(old)->>actor_key)::uuid) then return new; end if;
   end loop;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 -- A project/application cascade cannot evade closure while its organization
 -- exists. Existing immutable evidence may impose stricter deletion limits.
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_fiscal_application_closure() from public,anon,authenticated,service_role;
create trigger fiscal_application_closure before insert or update or delete on public.fiscal_sponsorship_applications
 for each row execute function public.guard_fiscal_application_closure();
create trigger fiscal_review_closure before insert or update or delete on public.fiscal_sponsorship_reviews
 for each row execute function public.guard_fiscal_application_closure();
comment on function public.guard_fiscal_application_closure() is
 'Serializes fiscal application/review writes with their owning organization closure, preserving exact profile cleanup and existing atomic revisions, policies and immutable evidence. Does not transfer staff-owned guest records to linked organizations or grant lifecycle authority.';
commit;
