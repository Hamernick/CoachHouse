\set ON_ERROR_STOP on
begin;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.fixture_closure_fiscal_ancillary();
set local role anon;
do $$ begin
 begin perform 1 from public.fiscal_guest_submissions; raise exception 'Guest rows exposed'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.fiscal_guest_email_outbox; raise exception 'Outbox exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
 begin perform public.fiscal_ancillary_owner('fiscal_guest_submissions','{}'); raise exception 'Private owner resolver exposed'; exception when insufficient_privilege then null; end;
 begin perform public.request_fiscal_guest_recovery_pre_closure(public.fixture_form_id(1801),'guest-applicant@example.org',public.fixture_form_id(1891));
 raise exception 'Recovery bypass exposed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 begin insert into public.fiscal_guest_email_proofs(job_id,submission_id,nonce,token_hash,expires_at)
 values(public.fixture_form_id(1812),public.fixture_form_id(1801),repeat('a',64),repeat('f',64),now()+interval '1 day') on conflict(job_id) do nothing;
 raise exception 'Cross-host proof admitted'; exception when insufficient_privilege then if sqlerrm<>'Fiscal ancillary parent scope mismatch' then raise; end if; end;
 begin insert into public.fiscal_staff_email_outbox(event_id,project_id,event_type)
 values(public.fixture_form_id(1822),public.fixture_form_id(1401),'document_reviewed') on conflict(event_id) do nothing;
 raise exception 'Cross-host staff job admitted'; exception when insufficient_privilege then if sqlerrm<>'Fiscal ancillary parent scope mismatch' then raise; end if; end;
end $$;
savepoint active_intake;
set local role service_role;
do $$ declare result jsonb; begin
 result:=public.fixture_fiscal_guest_submit();
 if result->>'created'<>'true' then raise exception 'Active guest intake failed'; end if;
 if public.fixture_fiscal_guest_submit()->>'created'<>'false' then raise exception 'Guest retry duplicated submission'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.fiscal_guest_submissions)<>3
 or (select count(*) from public.organization_tasks where created_source='system')<>1
 or (select count(*) from public.notifications)<>3 then raise exception 'Guest intake transaction incomplete'; end if;
end $$;
rollback to active_intake;
savepoint active_review;
set local role service_role;
do $$ begin
 if public.fixture_fiscal_application_review()->>'ok'<>'true' then raise exception 'Application review failed with delivery hooks'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.fiscal_sponsorship_reviews)<>3
 or not exists(select 1 from public.fiscal_sponsorship_events e join public.fiscal_staff_email_outbox q on q.event_id=e.id
 where e.application_id=public.fixture_form_id(1501) and e.event_type='application_approved' and q.status='pending') then
 raise exception 'Application review and staff delivery diverged'; end if;
end $$;
rollback to active_review;
savepoint active_link;
set local role authenticated;
do $$ begin if public.fixture_fiscal_link()->>'state'<>'linked' then raise exception 'Authorized link failed'; end if; end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.fiscal_application_organization_links where submission_id=public.fixture_form_id(1801) and org_id=public.fixture_form_id(14))
 or (select org_id from public.organization_projects where id=public.fixture_form_id(1401))<>public.fixture_form_id(1)
 or (select org_id from public.fiscal_sponsorship_applications where id=public.fixture_form_id(1501))<>public.fixture_form_id(1) then raise exception 'Link transferred staff ownership'; end if;
 perform public.organization_closure_command(public.fixture_form_id(14),public.fixture_form_id(14),'request',public.fixture_form_id(1890),0);
end $$;
set local role service_role;
select public.fixture_fiscal_recovery();
reset role;
do $$ begin if (select count(*) from public.fiscal_guest_email_outbox where kind='applicant_recovery')<>1 then raise exception 'Applicant closure stopped independent host'; end if; end $$;
rollback to active_link;
savepoint active_proof;
set local role service_role;
select public.claim_fiscal_guest_emails_v4();
select public.fixture_fiscal_prepare();
do $$ begin
 if public.verify_fiscal_guest_email(repeat('7',64),repeat('c',64),now()+interval '1 day')->>'reference' is null then raise exception 'Active proof exchange failed'; end if;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.fiscal_guest_verified_sessions where key_hash=repeat('c',64) and submission_id=public.fixture_form_id(1801)) then raise exception 'Verification lost session'; end if;
end $$;
rollback to active_proof;
-- Only lifecycle may stamp permanent suppression, even while active.
do $$ begin
 begin update public.fiscal_guest_email_outbox set closure_suppressed_at=now() where id=public.fixture_form_id(1811); raise exception 'Forged suppression admitted';
 exception when insufficient_privilege then if sqlerrm<>'Fiscal suppression is lifecycle-owned' then raise; end if; end;
 begin update public.fiscal_guest_submissions set contact_email='changed@example.org' where id=public.fixture_form_id(1801); raise exception 'Contact identity changed';
 exception when insufficient_privilege then if sqlerrm<>'Fiscal ancillary identity cannot change' then raise; end if; end;
end $$;
set local role service_role;
select public.claim_fiscal_guest_emails_v4();
select public.claim_fiscal_staff_emails_v2();
do $$ begin
 if not (select public.fiscal_guest_email_send_allowed(id,lease_token) from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811))
 or not (select public.fiscal_staff_email_send_allowed(event_id,lease_token) from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821)) then raise exception 'Active leased send denied'; end if;
end $$;
reset role;
select public.fixture_closure('request',600,0);
set local role service_role;
do $$ begin
 if (select public.fiscal_guest_email_send_allowed(id,lease_token) from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811))
 or (select public.fiscal_staff_email_send_allowed(event_id,lease_token) from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821)) then raise exception 'Closing delivery admitted'; end if;
 perform public.fixture_fiscal_recovery();
 if exists(select 1 from public.fiscal_guest_email_outbox where kind='applicant_recovery') then raise exception 'Closing recovery queued'; end if;
 begin perform public.verify_fiscal_guest_email(repeat('7',64),repeat('c',64),now()+interval '1 day'); raise exception 'Closing proof exchange admitted';
 exception when insufficient_privilege then if sqlerrm<>'Organization unavailable' then raise; end if; end;
 perform public.finish_fiscal_guest_email(id,lease_token,null,false) from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811);
 perform public.finish_fiscal_staff_email(event_id,lease_token,'synthetic-provider-message',true) from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821);
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1811) and status='failed' and closure_suppressed_at is not null and lease_token is null)
 or not exists(select 1 from public.fiscal_staff_email_outbox where event_id=public.fixture_form_id(1821) and status='sent' and provider_message_id='synthetic-provider-message' and closure_suppressed_at is not null)
 or exists(select 1 from public.fiscal_guest_email_outbox where id=public.fixture_form_id(1812) and closure_suppressed_at is not null) then raise exception 'Shutdown or late completion crossed boundaries'; end if;
end $$;
-- Existing revocation/proof-expiry authority survives, and cancellation restores none.
set local role service_role;
delete from public.fiscal_project_reviewers where project_id=public.fixture_form_id(1401);
delete from public.fiscal_guest_verified_sessions where submission_id=public.fixture_form_id(1801);
delete from public.fiscal_guest_email_proofs where submission_id=public.fixture_form_id(1801);
reset role;
select public.fixture_closure('cancel',601,1);
set local role service_role;
do $$ declare jobs jsonb; begin
 jobs:=public.claim_fiscal_guest_emails()||public.claim_fiscal_guest_emails_v3()||public.claim_fiscal_guest_emails_v4()
  ||public.claim_fiscal_staff_emails()||public.claim_fiscal_staff_emails_v2();
 if jobs::text like '%000000001811%' or jobs::text like '%000000001821%' then raise exception 'Cancel revived delivery'; end if;
 begin update public.fiscal_guest_email_outbox set status='pending' where id=public.fixture_form_id(1811); raise exception 'Manual retry revived suppression';
 exception when insufficient_privilege then if sqlerrm<>'Fiscal delivery permanently suppressed' then raise; end if; end;
 begin update public.fiscal_staff_email_outbox set closure_suppressed_at=null where event_id=public.fixture_form_id(1821); raise exception 'Suppression cleared';
 exception when insufficient_privilege then if sqlerrm<>'Fiscal suppression is lifecycle-owned' then raise; end if; end;
end $$;
reset role;
do $$ declare role_name text; begin
 if exists(select 1 from public.fiscal_project_reviewers where project_id=public.fixture_form_id(1401))
 or exists(select 1 from public.fiscal_guest_verified_sessions where submission_id=public.fixture_form_id(1801))
 or exists(select 1 from public.fiscal_guest_email_proofs where submission_id=public.fixture_form_id(1801)) then raise exception 'Cancel restored grants'; end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
 if has_function_privilege(role_name,'public.guard_fiscal_ancillary_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.suppress_fiscal_delivery_on_closure()','EXECUTE')
 or has_function_privilege(role_name,'public.organization_closure_command(uuid,uuid,text,uuid,integer)','EXECUTE') then raise exception 'Lifecycle authority exposed'; end if;
 end loop;
end $$;
rollback;
