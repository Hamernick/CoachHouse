-- Keep the public identity aligned with explicitly saved account identity.
-- Private contact information and About are never copied into a public bio.
create or replace function public.sync_account_public_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.public_person_profiles
  set display_name = coalesce(nullif(btrim(new.full_name), ''), display_name),
      headline = new.headline, avatar_url = new.avatar_url
  where profile_id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_account_public_identity() from public, anon, authenticated;
drop trigger if exists sync_account_public_identity on public.profiles;
create trigger sync_account_public_identity
  after insert or update of full_name, headline, avatar_url on public.profiles
  for each row execute function public.sync_account_public_identity();

create or replace function public.set_person_public_profile_visibility(p_is_public boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_is_public is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to update your profile.');
  end if;
  if not exists(select 1 from public.public_handles where profile_id = actor and owner_type = 'person') then
    return jsonb_build_object('ok', false, 'error', 'Choose a username before publishing.');
  end if;
  update public.public_person_profiles person
    set is_public = p_is_public,
        display_name = coalesce(nullif(btrim(account.full_name), ''), person.display_name),
        headline = account.headline, avatar_url = account.avatar_url
    from public.profiles account
    where person.profile_id = actor and account.id = actor;
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.save_person_public_profile_details(p_bio text, p_location_label text, p_website_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to update your profile.');
  end if;
  update public.public_person_profiles
    set bio = nullif(btrim(p_bio), ''), location_label = nullif(btrim(p_location_label), ''),
        website_url = nullif(btrim(p_website_url), '')
    where profile_id = actor;
  return jsonb_build_object('ok', found);
end;
$$;
revoke all on function public.set_person_public_profile_visibility(boolean) from public, anon;
revoke all on function public.save_person_public_profile_details(text, text, text) from public, anon;
grant execute on function public.set_person_public_profile_visibility(boolean) to authenticated;
grant execute on function public.save_person_public_profile_details(text, text, text) to authenticated;

insert into public.platform_email_topics(id, label, description, required)
values ('newsletter', 'Weekly newsletter', 'Curated resources and Coach House news.', false)
on conflict(id) do nothing;

-- Carry forward explicit account choices without overriding existing unsubscribes.
insert into public.platform_email_preferences(email, topic_id, status, source, person_id)
select lower(btrim(account.email)), choice.topic,
  case when (account.raw_user_meta_data->>choice.key)::boolean then 'subscribed' else 'unsubscribed' end,
  'account_settings_migration', account.id::text
from auth.users account
cross join (values ('marketing_opt_in', 'product_updates'), ('newsletter_opt_in', 'newsletter')) choice(key, topic)
where nullif(btrim(account.email), '') is not null
  and jsonb_typeof(account.raw_user_meta_data->choice.key) = 'boolean'
on conflict(email, topic_id) do nothing;

create or replace function public.save_account_email_preferences(p_marketing_opt_in boolean, p_newsletter_opt_in boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); address text; choice record;
begin
  select lower(btrim(email)) into address from auth.users where id = actor;
  if actor is null or nullif(address, '') is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to update email preferences.');
  end if;
  if (coalesce(p_marketing_opt_in, false) or coalesce(p_newsletter_opt_in, false))
      and exists(select 1 from public.platform_email_suppressions where lower(email) = address) then
    return jsonb_build_object('ok', false, 'error', 'Email delivery is blocked for this address. Contact support before subscribing again.');
  end if;
  for choice in select * from (values
      ('marketing_opt_in', 'product_updates', p_marketing_opt_in),
      ('newsletter_opt_in', 'newsletter', p_newsletter_opt_in)) item(key, topic, enabled)
      where item.enabled is not null
  loop
    insert into public.platform_email_preferences(email, topic_id, status, source, person_id)
      values(address, choice.topic, case when choice.enabled then 'subscribed' else 'unsubscribed' end,
        'account_settings', actor::text)
      on conflict(email, topic_id) do update set status = excluded.status, source = excluded.source,
        person_id = excluded.person_id, updated_at = now();
    insert into public.platform_email_consent_events(email, topic_id, action, source, person_id)
      values(address, choice.topic, case when choice.enabled then 'opt_in' else 'unsubscribe' end,
        'account_settings', actor::text);
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(choice.key, choice.enabled) where id = actor;
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.save_account_email_preferences(boolean, boolean) from public, anon;
grant execute on function public.save_account_email_preferences(boolean, boolean) to authenticated;
