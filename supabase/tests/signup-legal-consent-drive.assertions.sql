-- This file runs only in the disposable PostgreSQL cluster created by the runner.
do $$
declare
  fixture_id uuid;
  fixture_index integer := 0;
  version_data jsonb;
  acceptance public.platform_legal_acceptances%rowtype;
  consent jsonb;
begin
  for version_data in select value from jsonb_array_elements('[
    {"version":"2026-08-12.1","termsSha256":"405e53cfa64e4dba9ecb4e04289d82ed0b8f20b70a233a4b310996d63493e5a2","privacySha256":"c4ff2282fa5033042d4bcee3ed26ac4b1a5863b4cabd1346084c3d6097853d92"},
    {"version":"2026-08-27.1","termsSha256":"51bde17c17824786259ae9fe35f5b0740c7638c4705795d3de2805d1d0d80220","privacySha256":"4110a62f34947f3950dc75b7e6ffab87f60d9abfe48b44625c8150da5e845e62"},
    {"version":"2026-09-09.1","termsSha256":"7976c515ea20f08a89c0334d4135733d7a0d1088780bb1e6d5768d1c7ababef0","privacySha256":"3ba370741180467b5e1b43fad91feb6b0ac393634e500487588d15951e069b9f"},
    {"version":"2026-09-10.1","termsSha256":"8757308d709eac552572d79642b0374f6c41ee7c5277b50b961ce9948577e03c","privacySha256":"dd58c9175fd80b067658f07e503883f4f983c357413092e1533df8aeeccc0135"}
  ]'::jsonb) loop
    fixture_index := fixture_index + 1;
    fixture_id := ('00000000-0000-0000-0000-' || lpad((300 + fixture_index)::text, 12, '0'))::uuid;
    consent := version_data || '{"acceptedAt":"1999-01-01T00:00:00Z"}'::jsonb;
    insert into auth.users (id, raw_user_meta_data, raw_app_meta_data, created_at)
    values (fixture_id, jsonb_build_object('legal_consent', consent), null, '2026-09-10T12:00:00Z');

    select * into strict acceptance from public.platform_legal_acceptances where user_id = fixture_id;
    if acceptance.document_version <> consent ->> 'version'
      or acceptance.terms_sha256 <> consent ->> 'termsSha256'
      or acceptance.privacy_sha256 <> consent ->> 'privacySha256'
      or acceptance.accepted_at <> '2026-09-10T12:00:00Z'::timestamptz
      or acceptance.source <> 'signup'
    then
      raise exception 'Drive rollout failed consent tuple or server timestamp: %', fixture_index;
    end if;
  end loop;

  -- Reject both a current version with old hashes and old versions with current hashes.
  for version_data in select value from jsonb_array_elements('[
    {"version":"2026-08-12.1","termsSha256":"405e53cfa64e4dba9ecb4e04289d82ed0b8f20b70a233a4b310996d63493e5a2","privacySha256":"c4ff2282fa5033042d4bcee3ed26ac4b1a5863b4cabd1346084c3d6097853d92"},
    {"version":"2026-08-27.1","termsSha256":"51bde17c17824786259ae9fe35f5b0740c7638c4705795d3de2805d1d0d80220","privacySha256":"4110a62f34947f3950dc75b7e6ffab87f60d9abfe48b44625c8150da5e845e62"},
    {"version":"2026-09-09.1","termsSha256":"7976c515ea20f08a89c0334d4135733d7a0d1088780bb1e6d5768d1c7ababef0","privacySha256":"3ba370741180467b5e1b43fad91feb6b0ac393634e500487588d15951e069b9f"}
  ]'::jsonb) loop
    for consent in select value from jsonb_array_elements(jsonb_build_array(
      version_data || '{"version":"2026-09-10.1","acceptedAt":"2026-09-10T12:00:00Z"}'::jsonb,
      jsonb_build_object('version', version_data ->> 'version',
        'termsSha256', '8757308d709eac552572d79642b0374f6c41ee7c5277b50b961ce9948577e03c',
        'privacySha256', 'dd58c9175fd80b067658f07e503883f4f983c357413092e1533df8aeeccc0135',
        'acceptedAt', '2026-09-10T12:00:00Z')
    )) loop
      begin
        insert into auth.users (id, raw_user_meta_data, raw_app_meta_data)
        values ('00000000-0000-0000-0000-000000000399', jsonb_build_object('legal_consent', consent), '{}'::jsonb);
        raise exception 'Mismatched consent version and hashes were accepted';
      exception when sqlstate '22023' then null;
      end;
    end loop;
  end loop;

  if exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000399') then
    raise exception 'Rejected signup left an auth user behind';
  end if;

  -- Previously recorded acceptance is immutable across the rollout.
  if (select count(*) from public.platform_legal_acceptances
      where document_version = '2026-09-09.1' and accepted_at = '2026-09-09T15:00:00Z') <> 1 then
    raise exception 'Drive rollout modified the Calendar acceptance record';
  end if;
  if (select count(*) from public.platform_legal_acceptances
      where document_version = '2026-08-27.1' and accepted_at = '2026-09-04T12:00:00Z') <> 8 then
    raise exception 'Drive rollout modified historical acceptance';
  end if;
end;
$$;

set role authenticated;
do $$
begin
  if (select count(*) from public.platform_legal_acceptances) <> 0 then
    raise exception 'An unrelated authenticated user could read acceptance records';
  end if;
  begin
    update public.platform_legal_acceptances set document_version = 'forged';
    raise exception 'Authenticated user could mutate acceptance records';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set role anon;
do $$
begin
  begin
    perform count(*) from public.platform_legal_acceptances;
    raise exception 'Anonymous user could read acceptance records';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
