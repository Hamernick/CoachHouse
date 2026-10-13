begin;
do $$
declare s public.fiscal_guest_submissions%rowtype; job public.fiscal_guest_email_outbox%rowtype;
 states jsonb; state text; reviewer uuid:='10000000-0000-0000-0000-000000000003';
begin
 if has_table_privilege('authenticated','public.fiscal_email_delivery_events','select')
 or has_function_privilege('anon','public.record_fiscal_email_delivery(text,text,text,timestamptz)','execute')
 or has_function_privilege('authenticated','public.record_fiscal_email_delivery(text,text,text,timestamptz)','execute')
 or has_function_privilege('anon','public.get_fiscal_guest_email_status(uuid,uuid)','execute')
 then raise exception 'Delivery privilege leak'; end if;
 select * into s from public.fiscal_guest_submissions order by created_at,id limit 1;
 select * into job from public.fiscal_guest_email_outbox where submission_id=s.id and kind='applicant_receipt';
 -- Webhook arrives before the dispatcher records its provider id.
 perform public.record_fiscal_email_delivery('delivered-test','provider-test','email.delivered','2026-10-11T12:00:00Z');
 perform public.record_fiscal_email_delivery('delivered-test','provider-test','email.delivered','2026-10-11T12:00:00Z');
 if (select count(*) from public.fiscal_email_delivery_events)<>1 then raise exception 'Duplicate receipt'; end if;
 begin
  perform public.record_fiscal_email_delivery('delivered-test','different-provider','email.failed','2026-10-11T12:00:00Z');
  raise exception 'Conflicting duplicate accepted';
 exception when raise_exception then if sqlerrm <> 'Conflicting provider event' then raise; end if; end;
 update public.fiscal_guest_email_outbox set provider_message_id='provider-test',status='sent' where id=job.id;
 perform public.record_fiscal_email_delivery('sent-late','provider-test','email.sent','2026-10-11T12:01:00Z');
 perform public.record_fiscal_email_delivery('delay-late','provider-test','email.delivery_delayed','2026-10-11T12:02:00Z');
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 states:=public.get_fiscal_guest_email_status(s.project_id,reviewer);
 select item->>'status' into state from jsonb_array_elements(states) item where item->>'recipient'='Applicant';
 if state is distinct from 'email.delivered' then raise exception 'Delivery regressed or missed before ack: %',state; end if;
 perform public.record_fiscal_email_delivery('bounce','provider-test','email.bounced','2026-10-11T12:03:00Z');
 states:=public.get_fiscal_guest_email_status(s.project_id,reviewer);
 select item->>'status' into state from jsonb_array_elements(states) item where item->>'recipient'='Applicant';
 if state is distinct from 'email.bounced' then raise exception 'Bounce not visible'; end if;
 if jsonb_array_length(states)<>3 then raise exception 'Missing applicant or reviewer queues'; end if;
 if states::text like '%example.test%' or states::text like '%provider-test%' then raise exception 'Unneeded delivery identifiers leaked'; end if;
 perform public.record_fiscal_email_delivery('orphan','old-provider','email.sent','2026-01-01T00:00:00Z');
 update public.fiscal_email_delivery_events set received_at=now()-interval '91 days';
 if public.purge_fiscal_email_delivery_events()<>1 then raise exception 'Retention removed linked outcomes or retained orphan'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ declare pid uuid; begin
 -- Use ordinary owner, not an assigned reviewer. No private table SELECT needed.
 select id into pid from public.organization_projects limit 1;
 if public.get_fiscal_guest_email_status(pid,auth.uid()) is not null then raise exception 'Host owner sees guest mail'; end if;
 begin
  perform public.get_fiscal_guest_email_status(pid,'10000000-0000-0000-0000-000000000002');
  raise exception 'Reviewer impersonation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
