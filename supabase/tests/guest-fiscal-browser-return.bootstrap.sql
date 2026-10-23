-- Existing production case: email confirmed on a phone, original cookie unverified.
update public.fiscal_guest_submissions set email_verified_at=coalesce(email_verified_at,now());
insert into public.fiscal_guest_verified_sessions(key_hash,submission_id,expires_at)
 select repeat('5',64),id,now()+interval '1 day' from public.fiscal_guest_submissions
 on conflict(key_hash,submission_id) do update set expires_at=excluded.expires_at;
delete from public.fiscal_guest_verified_sessions v using public.fiscal_guest_submissions s
 where v.submission_id=s.id and v.key_hash=s.submission_key_hash;
