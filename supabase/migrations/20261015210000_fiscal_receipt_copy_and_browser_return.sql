-- Capture only applicant answers at receipt creation. Existing jobs retain their
-- old content/provider key; private review state never enters the receipt.
alter table public.fiscal_guest_email_outbox add column receipt_snapshot jsonb;
alter table public.fiscal_guest_email_outbox add constraint fiscal_receipt_snapshot_check
 check (receipt_snapshot is null or (kind='applicant_receipt'
   and jsonb_typeof(receipt_snapshot)='object' and octet_length(receipt_snapshot::text)<=100000));

create function public.capture_fiscal_guest_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
declare a public.fiscal_sponsorship_applications%rowtype;
begin
 if tg_op='UPDATE' then
  if new.receipt_snapshot is distinct from old.receipt_snapshot then
   raise exception 'Receipt snapshot is immutable';
  end if;
  return new;
 end if;
 if new.kind='applicant_receipt' then
  select app.* into a from public.fiscal_guest_submissions s
   join public.fiscal_sponsorship_applications app on app.id=s.application_id
   where s.id=new.submission_id and lower(new.recipient)=lower(s.contact_email);
  if not found then raise exception 'Receipt recipient does not match application'; end if;
  select jsonb_object_agg(key,value) into new.receipt_snapshot from jsonb_each(to_jsonb(a))
   where key=any(public.fiscal_guest_editable_fields());
  new.receipt_snapshot:=new.receipt_snapshot||jsonb_build_object('fundraising_goal',a.metadata->'fundraisingGoal');
 end if;
 return new;
end $$;
revoke all on function public.capture_fiscal_guest_receipt() from public,anon,authenticated;
create trigger fiscal_guest_receipt_snapshot before insert or update of receipt_snapshot
 on public.fiscal_guest_email_outbox for each row execute function public.capture_fiscal_guest_receipt();

-- New workers claim all jobs; older workers may claim only legacy content.
-- This prevents deployment/retry races from changing a provider idempotency body.
do $patch$
declare original text; updated text;
 old_ready text := $a$where (status='pending' and available_at<=now()) or (status='sending' and leased_until<=now())$a$;
 new_ready text := $b$where receipt_snapshot is null and ((status='pending' and available_at<=now()) or (status='sending' and leased_until<=now()))$b$;
begin
 original:=pg_get_functiondef('public.claim_fiscal_guest_emails()'::regprocedure);
 if strpos(original,old_ready)=0
  or strpos(original,'q.kind,q.recipient,q.lease_token')=0
  or strpos(original,$a$'recipient',c.recipient,'leaseToken',c.lease_token$a$)=0 then
  raise exception 'Unexpected fiscal mail claim definition';
 end if;
 updated:=replace(original,'FUNCTION public.claim_fiscal_guest_emails()', 'FUNCTION public.claim_fiscal_guest_emails_v3()');
 updated:=replace(updated,'q.kind,q.recipient,q.lease_token','q.kind,q.recipient,q.lease_token,q.receipt_snapshot');
 updated:=replace(updated,$a$'recipient',c.recipient,'leaseToken',c.lease_token$a$,
  $b$'recipient',c.recipient,'leaseToken',c.lease_token,'receiptSnapshot',c.receipt_snapshot$b$);
 execute updated;
 execute replace(original,old_ready,new_ready);
end $patch$;
revoke all on function public.claim_fiscal_guest_emails_v3() from public,anon,authenticated;
grant execute on function public.claim_fiscal_guest_emails_v3() to service_role;

-- Email confirmation also authorizes the original, secret submission session.
-- The exchanged link still cannot be replayed in an unrelated browser. Do not
-- renew expired/revoked original grants or extend the original seven-day window.
do $patch$
declare definition text;
 marker text := $a$return jsonb_build_object('reference',v_proof.submission_id);$a$;
begin
 definition:=pg_get_functiondef('public.verify_fiscal_guest_email(text,text,timestamp with time zone)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Unexpected fiscal verification definition'; end if;
 execute replace(definition,marker,$body$
  insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at)
   select s.submission_key_hash,s.id,least(p_expires_at,s.created_at+interval '7 days')
   from public.fiscal_guest_submissions s
   where s.id=v_proof.submission_id and s.created_at+interval '7 days'>now()
   on conflict(key_hash,submission_id) do nothing;
  return jsonb_build_object('reference',v_proof.submission_id);
 $body$);
end $patch$;

-- Recover existing recent submitters whose email was confirmed on another device.
insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at)
 select s.submission_key_hash,s.id,least(max(v.expires_at),s.created_at+interval '7 days')
 from public.fiscal_guest_submissions s
 join public.fiscal_guest_verified_sessions v on v.submission_id=s.id and v.expires_at>now()
 where s.email_verified_at is not null and s.created_at+interval '7 days'>now()
 group by s.id,s.submission_key_hash,s.created_at
 on conflict(key_hash,submission_id) do nothing;

notify pgrst, 'reload schema';
