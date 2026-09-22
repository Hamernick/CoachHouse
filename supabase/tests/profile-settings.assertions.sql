reset role;
do $$ begin
  if (select status from public.platform_email_preferences where email='settings@example.test' and topic_id='product_updates') <> 'unsubscribed' then
    raise exception 'migration overwrote an existing unsubscribe';
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select public.claim_person_public_handle('settings-tester');
select public.save_person_public_profile_details('Public biography','Chicago','https://example.test');
select public.set_person_public_profile_visibility(true);
reset role;
update public.profiles set full_name='Updated Name',headline='Updated role',avatar_url='https://example.test/new.png'
where id='00000000-0000-0000-0000-000000000005';
update public.public_person_profiles set show_saved_locations=true,show_program_activity=false
where profile_id='00000000-0000-0000-0000-000000000005';
set role authenticated;
select public.set_person_public_profile_visibility(false);
select public.set_person_public_profile_visibility(true);
do $$ declare p record; begin
  select * into p from public.public_person_profiles where profile_id=auth.uid();
  if p.display_name <> 'Updated Name' or p.headline <> 'Updated role' or p.avatar_url <> 'https://example.test/new.png'
    or p.bio <> 'Public biography' or p.location_label <> 'Chicago' then raise exception 'identity synchronization/details failed'; end if;
  if not p.show_saved_locations or p.show_program_activity then raise exception 'visibility overwrote unrelated publication flags'; end if;
end $$;
select public.save_account_email_preferences(false,true);
reset role;
do $$ begin
  if not exists(select 1 from public.platform_email_preferences where email='settings@example.test' and topic_id='newsletter' and status='subscribed') then raise exception 'newsletter not saved'; end if;
  if (select raw_user_meta_data->>'newsletter_opt_in' from auth.users where email='settings@example.test') <> 'true' then raise exception 'legacy preferences diverged'; end if;
  if (select count(*) from public.platform_email_consent_events where email='settings@example.test') <> 2 then raise exception 'consent not audited'; end if;
end $$;
insert into public.platform_email_suppressions(email,reason) values('settings@example.test','complaint');
set role authenticated;
do $$ begin
  if public.save_account_email_preferences(true,null)->>'ok' <> 'false' then raise exception 'suppression bypassed'; end if;
end $$;
-- Another account cannot target the owner's profile; the API accepts no actor id.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
do $$ begin
  if public.save_person_public_profile_details('attack',null,null)->>'ok' <> 'false' then raise exception 'nonowner mutation succeeded'; end if;
  if public.set_person_public_profile_visibility(false)->>'ok' <> 'false' then raise exception 'nonowner visibility succeeded'; end if;
end $$;
reset role;
do $$ begin
  if (select bio from public.public_person_profiles where profile_id='00000000-0000-0000-0000-000000000005') <> 'Public biography' then raise exception 'owner data changed'; end if;
  if has_function_privilege('anon','public.set_person_public_profile_visibility(boolean)','execute') or has_function_privilege('anon','public.save_account_email_preferences(boolean,boolean)','execute') then raise exception 'anonymous write allowed'; end if;
end $$;
