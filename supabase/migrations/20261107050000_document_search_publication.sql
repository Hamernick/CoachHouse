-- Private profile search uses actor-checked application readers, not this legacy index.
begin;
create or replace function public.public_organization_narrative_plain_text(
 p_profile jsonb, p_section_id text, p_legacy_key text
) returns text language sql immutable parallel safe set search_path='' as $$
 with target as (
  select section from (
   select entry section from jsonb_array_elements(case when jsonb_typeof(p_profile->'roadmap'->'sections')='array' then p_profile->'roadmap'->'sections' else '[]'::jsonb end) entry where entry->>'id'=p_section_id
   union all
   select entry from jsonb_each(case when jsonb_typeof(p_profile->'roadmap'->'sections')='object' then p_profile->'roadmap'->'sections' else '{}'::jsonb end) stored(key,entry) where coalesce(entry->>'id',stored.key)=p_section_id
  ) candidates limit 1
 )
 select case
  when section->>'documentSource'='google_drive' or (section->>'documentSource' is null and jsonb_typeof(section->'driveSource')='object') then ''
  when section->>'publicProfileStatusControlled'='true' then
   case when section->>'status'='complete' then btrim(regexp_replace(regexp_replace(coalesce(section->>'content',''),'<[^>]*>',' ','g'),'[[:space:]]+',' ','g')) else '' end
  when section is null or section->>'lastUpdated' is null then
   public.organization_narrative_plain_text(jsonb_build_object(p_legacy_key,p_profile->p_legacy_key),p_section_id,p_legacy_key)
  else public.organization_narrative_plain_text(p_profile,p_section_id,p_legacy_key)
 end from (select 1) seed left join target on true;
$$;
-- The view is not granted to clients. Replace its narrative expression without
-- copying the unrelated academy/program indexing definitions.
do $$ declare definition text; begin
 definition:=pg_get_viewdef('public.search_index'::regclass,true);
 if position('organization_narrative_plain_text(' in definition)=0 or position('public_organization_narrative_plain_text(' in definition)>0 then
  raise exception 'Unexpected search index definition';
 end if;
 execute 'create or replace view public.search_index as '||replace(definition,'organization_narrative_plain_text(','public_organization_narrative_plain_text(');
end $$;
create or replace function public.search_global(
  p_query text,
  p_user_id uuid,
  p_is_admin boolean,
  p_limit integer default 30
)
returns table(
  id text,
  label text,
  subtitle text,
  href text,
  group_name text,
  rank real
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select
      auth.uid() as effective_user_id,
      public.is_admin() as is_admin,
      websearch_to_tsquery('english', p_query) as query
  )
  select
    i.id,
    i.label,
    i.subtitle,
    i.href,
    i.group_name,
    ts_rank_cd(i.tsv, params.query) as rank
  from search_index i, params
  where params.effective_user_id is not null and i.tsv @@ params.query
    and (
      (i.scope = 'owner' and i.group_name = 'Programs' and i.user_id = params.effective_user_id)
      or (i.scope = 'public' and i.user_id = any(public.filter_public_organization_ids(array[i.user_id], 'profile')))
      or (i.scope = 'academy' and (i.is_published or params.is_admin))
    )
  order by rank desc, i.label asc
  limit greatest(1, least(coalesce(p_limit, 30), 50));
$$;

revoke all on function public.search_global(text, uuid, boolean, integer) from public;
grant execute on function public.search_global(text, uuid, boolean, integer) to authenticated;

commit;
