\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_fiscal_signing();
set local role authenticated;
do $$ begin
 if exists(select 1 from public.fiscal_sponsorship_signing_drafts) then raise exception 'Owner implicitly read signer draft'; end if;
 begin perform public.fixture_fiscal_send(); raise exception 'Send RPC exposed'; exception when insufficient_privilege then null; end;
 begin perform public.fixture_fiscal_sign(); raise exception 'Sign RPC exposed'; exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000013';
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_signing_drafts)<>2 then raise exception 'Signer cannot read own drafts'; end if;
 update public.fiscal_sponsorship_signing_drafts set signer_title='Director' where id=public.fixture_form_id(1711);
 if not found then raise exception 'Active signer cannot save'; end if;
end $$;
reset role;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ declare relation text; col text; begin
 foreach relation in array array['fiscal_sponsorship_signature_packets','fiscal_sponsorship_signing_drafts'] loop
 foreach col in array array['id','org_id','project_id','application_id'] loop
 begin execute format('update public.%I set %I=public.fixture_form_id(1799) where org_id=public.fixture_form_id(1)',relation,col);
 raise exception 'Signing identity changed'; exception when insufficient_privilege then if sqlerrm<>'Fiscal signing identity cannot change' then raise; end if; end;
 end loop; end loop;
 begin update public.fiscal_sponsorship_signing_drafts set signer_id=public.fixture_form_id(1) where id=public.fixture_form_id(1711);
 raise exception 'Signer reassigned'; exception when insufficient_privilege then if sqlerrm<>'Fiscal draft signer cannot change' then raise; end if; end;
end $$;
savepoint signature_revision;
update public.fiscal_sponsorship_signing_drafts set revision=1 where id=public.fixture_form_id(1711);
set local role service_role;
do $$ begin
 begin perform public.fixture_fiscal_sign(); raise exception 'Stale signature admitted'; exception when raise_exception then
 if sqlerrm<>'Applicant signing draft changed in another session' then raise; end if; end;
end $$;
reset role;
do $$ begin if exists(select 1 from public.fiscal_sponsorship_signatures) or exists(select 1 from public.fiscal_sponsorship_events) then raise exception 'Stale signature left evidence'; end if; end $$;
rollback to signature_revision;
savepoint signed_flow;
set local role service_role;
do $$ begin
 if public.fixture_fiscal_send()->>'ok'<>'true' then raise exception 'Active send failed'; end if;
 if public.fixture_fiscal_send()->>'transitioned'<>'false' then raise exception 'Send replay duplicated packet'; end if;
 if public.fixture_fiscal_sign()->>'status'<>'applicant_signed' then raise exception 'Active signature failed'; end if;
 if public.fixture_fiscal_countersign()->>'status'<>'completed' then raise exception 'Active countersignature failed'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_signatures)<>2 or (select count(*) from public.fiscal_sponsorship_events)<>3
 or (select status from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501))<>'countersigned'
 or not exists(select 1 from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701) and revision=2
 and executed_document_id is not null and audit_document_id is not null) then raise exception 'Signing transaction effects diverged'; end if;
 begin delete from public.fiscal_sponsorship_signatures; raise exception 'Signature evidence erased'; exception when raise_exception then
 if sqlerrm<>'Fiscal signing evidence is immutable' then raise; end if; end;
 begin update public.fiscal_sponsorship_events set summary='Changed'; raise exception 'Event evidence edited'; exception when raise_exception then
 if sqlerrm<>'Fiscal signing evidence is immutable' then raise; end if; end;
 begin delete from auth.users where id=public.fixture_form_id(13); raise exception 'Signed account evidence bypassed';
 exception when foreign_key_violation then null; when raise_exception then if sqlerrm<>'Fiscal signing evidence is immutable' then raise; end if; end;
end $$;
rollback to signed_flow;
-- Preserve exact legacy cross-org reference nullification, not evidence mutation.
update public.fiscal_sponsorship_signature_packets set executed_document_id=public.fixture_form_id(1522),audit_document_id=public.fixture_form_id(1522)
 where id=public.fixture_form_id(1701);
select public.fixture_closure('request',600,0);
create function public.fixture_counterfeit_signing_cleanup() returns trigger language plpgsql as $$ begin
 update public.fiscal_sponsorship_signature_packets set sent_by=null where id=public.fixture_form_id(1701); return new; end $$;
create temporary table counterfeit_signing_cleanup(n integer);
create trigger counterfeit after insert on counterfeit_signing_cleanup for each row execute function public.fixture_counterfeit_signing_cleanup();
do $$ begin
 begin insert into counterfeit_signing_cleanup values(1); raise exception 'Counterfeit signing cleanup admitted'; exception when insufficient_privilege then
 if sqlerrm<>'Organization unavailable' then raise; end if; end;
 delete from public.fiscal_sponsorship_documents where id=public.fixture_form_id(1522);
 if not exists(select 1 from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701)
 and executed_document_id is null and audit_document_id is null and status='sent') then raise exception 'Cross-org reference cleanup failed'; end if;
 delete from auth.users where id=public.fixture_form_id(13);
 if exists(select 1 from public.fiscal_sponsorship_signing_drafts) or not exists(select 1 from public.fiscal_sponsorship_signature_packets
 where id=public.fixture_form_id(1701) and sent_by is null and applicant_signer_id is null and coach_signer_id is null and status='sent')
 or not exists(select 1 from auth.users where id=public.fixture_form_id(12)) then raise exception 'Separate account cleanup failed'; end if;
 perform public.fixture_closure('cancel',601,1);
 if exists(select 1 from public.fiscal_sponsorship_signing_drafts) or public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is not null
 or exists(select 1 from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)) then raise exception 'Cancel resurrected access or drafts'; end if;
 perform public.fixture_closure('request',602,2);
end $$;
update public.organization_closures set requested_at='2000-01-01Z',export_until='2000-01-31Z';
do $$ declare role_name text; relation text; begin
 begin delete from public.fiscal_sponsorship_signature_packets where id=public.fixture_form_id(1701); raise exception 'Expiry authorized purge';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 foreach relation in array array['fiscal_sponsorship_signature_packets','fiscal_sponsorship_signing_drafts','fiscal_sponsorship_signatures','fiscal_sponsorship_events'] loop
 if not (select relrowsecurity and relforcerowsecurity from pg_class where oid=('public.'||relation)::regclass) then raise exception 'Signing RLS removed'; end if;
 end loop;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_fiscal_signing_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;
