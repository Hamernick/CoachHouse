-- MCP credentials are opaque and never usable as Supabase user credentials.
-- Supabase upstream sessions belong to the dedicated broker OAuth client, not
-- the user's browser session. Only ciphertext and hashed bearer values persist.
begin;

create table public.companion_oauth_transactions (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  request jsonb not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz
);
create index companion_oauth_transactions_expiry on public.companion_oauth_transactions(expires_at);
create index companion_oauth_transactions_rate on public.companion_oauth_transactions(fingerprint, created_at);

create table public.companion_oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  resource text not null,
  scopes text[] not null check (scopes <@ array['accelerator:read', 'accelerator:write']::text[] and 'accelerator:read' = any(scopes)),
  upstream text not null,
  rotation integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz
);
create index companion_oauth_grants_user on public.companion_oauth_grants(user_id);

create table public.companion_oauth_codes (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  grant_id uuid not null references public.companion_oauth_grants(id) on delete cascade,
  challenge text not null,
  redirect_uri text not null,
  expires_at timestamptz not null default now() + interval '2 minutes',
  consumed_at timestamptz
);

create table public.companion_oauth_tokens (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  grant_id uuid not null references public.companion_oauth_grants(id) on delete cascade,
  kind text not null check (kind in ('access', 'refresh')),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create index companion_oauth_tokens_grant on public.companion_oauth_tokens(grant_id);

alter table public.companion_oauth_transactions enable row level security;
alter table public.companion_oauth_grants enable row level security;
alter table public.companion_oauth_codes enable row level security;
alter table public.companion_oauth_tokens enable row level security;
revoke all on public.companion_oauth_transactions, public.companion_oauth_grants,
  public.companion_oauth_codes, public.companion_oauth_tokens from public, anon, authenticated;
grant all on public.companion_oauth_transactions, public.companion_oauth_grants,
  public.companion_oauth_codes, public.companion_oauth_tokens to service_role;

create function public.companion_oauth_store(p_action text, p_key text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tx public.companion_oauth_transactions;
  v_grant public.companion_oauth_grants;
  v_code public.companion_oauth_codes;
  v_token public.companion_oauth_tokens;
  v_scopes text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise insufficient_privilege using message = 'Server connection credentials required';
  end if;
  if length(p_key) > 128 or pg_column_size(p_payload) > 65536 then
    return jsonb_build_object('error', 'invalid_request');
  end if;

  if p_action = 'create_transaction' then
    -- Hash is keyed server-side. Raw IPs never enter the connection store.
    perform pg_advisory_xact_lock(hashtextextended(p_payload->>'fingerprint', 0));
    if (select count(*) from public.companion_oauth_transactions
        where fingerprint = p_payload->>'fingerprint' and created_at > now() - interval '10 minutes') >= 30 then
      return jsonb_build_object('error', 'rate_limited');
    end if;
    insert into public.companion_oauth_transactions(state_hash, request, fingerprint)
      values (p_key, p_payload->'request', p_payload->>'fingerprint');
    return jsonb_build_object('ok', true);
  elsif p_action in ('read_transaction', 'consume_transaction') then
    select * into v_tx from public.companion_oauth_transactions where state_hash = p_key for update;
    if not found or v_tx.expires_at <= now() or v_tx.consumed_at is not null then
      return null;
    end if;
    if p_action = 'consume_transaction' then
      update public.companion_oauth_transactions set consumed_at = now() where state_hash = p_key;
    end if;
    return v_tx.request;
  elsif p_action = 'create_grant' then
    select coalesce(array_agg(x), '{}'::text[]) into v_scopes
      from jsonb_array_elements_text(p_payload->'scopes') x;
    insert into public.companion_oauth_grants(user_id, client_id, resource, scopes, upstream)
      values ((p_payload->>'userId')::uuid, p_payload->>'clientId', p_payload->>'resource', v_scopes, p_payload->>'upstream')
      returning * into v_grant;
    insert into public.companion_oauth_codes(code_hash, grant_id, challenge, redirect_uri)
      values (p_key, v_grant.id, p_payload->>'challenge', p_payload->>'redirectUri');
  elsif p_action = 'exchange_code' then
    select * into v_code from public.companion_oauth_codes where code_hash = p_key for update;
    if not found then return jsonb_build_object('error', 'invalid_grant'); end if;
    select * into v_grant from public.companion_oauth_grants where id = v_code.grant_id for update;
    if v_grant.client_id is distinct from p_payload->>'clientId' or v_grant.resource is distinct from p_payload->>'resource'
      or v_code.redirect_uri is distinct from p_payload->>'redirectUri' or v_code.challenge is distinct from p_payload->>'challenge' then
      return jsonb_build_object('error', 'invalid_grant');
    end if;
    if v_code.consumed_at is not null then
      update public.companion_oauth_grants set revoked_at = now() where id = v_grant.id;
      return jsonb_build_object('error', 'invalid_grant');
    end if;
    if v_code.expires_at <= now() or v_grant.revoked_at is not null or v_grant.expires_at <= now() then
      return jsonb_build_object('error', 'invalid_grant');
    end if;
    update public.companion_oauth_codes set consumed_at = now() where code_hash = p_key;
  elsif p_action in ('access', 'rotate_refresh', 'revoke') then
    select * into v_token from public.companion_oauth_tokens where token_hash = p_key for update;
    if not found then return null; end if;
    select * into v_grant from public.companion_oauth_grants where id = v_token.grant_id for update;
    if p_action = 'rotate_refresh' and (v_grant.client_id is distinct from p_payload->>'clientId'
      or v_grant.resource is distinct from p_payload->>'resource') then return null; end if;
    if p_action = 'revoke' then
      if v_grant.client_id is distinct from p_payload->>'clientId' then return null; end if;
      update public.companion_oauth_grants set revoked_at = now() where id = v_grant.id;
    else
      if p_action = 'rotate_refresh' and v_token.kind = 'refresh' and v_token.consumed_at is not null then
        update public.companion_oauth_grants set revoked_at = now() where id = v_grant.id;
        return jsonb_build_object('error', 'invalid_grant');
      end if;
      if v_token.expires_at <= now() or v_grant.revoked_at is not null or v_grant.expires_at <= now() then return null; end if;
      if p_action = 'access' and v_token.kind <> 'access' then return null; end if;
      if p_action = 'rotate_refresh' then
        if v_token.kind <> 'refresh' then return null; end if;
        if p_payload ? 'scopes' then
          select coalesce(array_agg(x), '{}'::text[]) into v_scopes
            from jsonb_array_elements_text(p_payload->'scopes') x;
          if not v_scopes <@ v_grant.scopes or not 'accelerator:read' = any(v_scopes) then
            return jsonb_build_object('error', 'invalid_scope');
          end if;
          v_grant.scopes := v_scopes;
        end if;
        update public.companion_oauth_tokens set consumed_at = now() where token_hash = p_key;
        update public.companion_oauth_grants set rotation = rotation + 1, scopes = v_grant.scopes
          where id = v_grant.id returning * into v_grant;
      end if;
    end if;
  elsif p_action = 'save_upstream' then
    update public.companion_oauth_grants set upstream = p_payload->>'upstream'
      where id = p_key::uuid and rotation = (p_payload->>'rotation')::integer
      and revoked_at is null and expires_at > now() returning * into v_grant;
    if not found then return null; end if;
  else
    return jsonb_build_object('error', 'invalid_request');
  end if;

  if p_action in ('exchange_code', 'rotate_refresh') then
    insert into public.companion_oauth_tokens(token_hash, grant_id, kind, expires_at) values
      (p_payload->>'accessHash', v_grant.id, 'access', least(now() + interval '15 minutes', v_grant.expires_at)),
      (p_payload->>'refreshHash', v_grant.id, 'refresh', v_grant.expires_at);
  end if;
  return jsonb_build_object('id', v_grant.id, 'userId', v_grant.user_id, 'clientId', v_grant.client_id,
    'resource', v_grant.resource, 'scopes', v_grant.scopes, 'upstream', v_grant.upstream, 'rotation', v_grant.rotation);
end;
$$;
revoke all on function public.companion_oauth_store(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.companion_oauth_store(text, text, jsonb) to service_role;

commit;
