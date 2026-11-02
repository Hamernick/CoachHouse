-- Complete the canonical fiscal workflow fence without relaxing evidence retention.
begin;
create function public.guard_fiscal_signing_closure() returns trigger
 language plpgsql security definer set search_path='' as $$
declare org uuid; field text;
begin
 org:=case when tg_op='DELETE' then old.org_id else new.org_id end;
 if tg_op='UPDATE' then
   foreach field in array array['id','org_id','project_id','application_id','packet_id','document_id','provider'] loop
     if to_jsonb(new)->field is distinct from to_jsonb(old)->field then
       raise exception 'Fiscal signing identity cannot change' using errcode='42501'; end if;
   end loop;
   if tg_table_name='fiscal_sponsorship_signing_drafts' and
     (to_jsonb(new)->'signer_id' is distinct from to_jsonb(old)->'signer_id'
       or to_jsonb(new)->'signer_role' is distinct from to_jsonb(old)->'signer_role') then
     raise exception 'Fiscal draft signer cannot change' using errcode='42501'; end if;
   if tg_table_name='fiscal_sponsorship_signature_packets' then
     foreach field in array array['sent_by','applicant_signer_id','coach_signer_id'] loop
       if pg_trigger_depth()>1 and to_jsonb(old)->>field is not null and to_jsonb(new)->>field is null
         and (to_jsonb(old)-array[field,'updated_at'])=(to_jsonb(new)-array[field,'updated_at'])
         and not exists(select 1 from public.profiles where id=(to_jsonb(old)->>field)::uuid) then return new; end if;
     end loop;
     foreach field in array array['executed_document_id','audit_document_id'] loop
       if pg_trigger_depth()>1 and to_jsonb(old)->>field is not null and to_jsonb(new)->>field is null
         and (to_jsonb(old)-array[field,'updated_at'])=(to_jsonb(new)-array[field,'updated_at'])
         and not exists(select 1 from public.fiscal_sponsorship_documents where id=(to_jsonb(old)->>field)::uuid) then return new; end if;
     end loop;
   end if;
 end if;
 -- Unsubmitted autosave state belongs to its signer. Preserve exact account-FK
 -- cleanup, while immutable signatures/events keep their existing restrictions.
 if tg_op='DELETE' and tg_table_name='fiscal_sponsorship_signing_drafts' then
   if pg_trigger_depth()>1 and not exists(select 1 from public.profiles where id=old.signer_id) then return old; end if;
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception 'Closure boundary requires read committed isolation' using errcode='40001'; end if;
 if tg_op='DELETE' and not exists(select 1 from public.organizations where user_id=org) then return old; end if;
 perform public.guard_uploaded_document_organization(org);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_fiscal_signing_closure() from public,anon,authenticated,service_role;
create trigger fiscal_packet_closure before insert or update or delete on public.fiscal_sponsorship_signature_packets
 for each row execute function public.guard_fiscal_signing_closure();
create trigger fiscal_draft_closure before insert or update or delete on public.fiscal_sponsorship_signing_drafts
 for each row execute function public.guard_fiscal_signing_closure();
-- UPDATE/DELETE already reject unconditionally through immutable-evidence triggers.
create trigger fiscal_signature_closure before insert on public.fiscal_sponsorship_signatures
 for each row execute function public.guard_fiscal_signing_closure();
create trigger fiscal_event_closure before insert on public.fiscal_sponsorship_events
 for each row execute function public.guard_fiscal_signing_closure();
comment on function public.guard_fiscal_signing_closure() is
 'Fences packet/draft writes and new signature/event evidence by owning organization. Preserves exact FK cleanup, immutable evidence and existing signer/RPC authority; grants no provider, read, purge or lifecycle access.';
commit;
