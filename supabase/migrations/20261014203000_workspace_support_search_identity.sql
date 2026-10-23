-- Search the platform directory by organization identity and the people who own
-- or belong to it. Contact fields remain restricted to explicit support staff.
create function public.workspace_support_search_key(value text) returns text
language sql immutable set search_path='' as $$
 select regexp_replace(lower(coalesce(value,'')),'[^[:alnum:]]','','g');
$$;
revoke all on function public.workspace_support_search_key(text) from public,anon;
grant execute on function public.workspace_support_search_key(text) to authenticated;

create function public.search_workspace_support_organizations_v2(p_query text,p_org uuid default null,p_offset integer default 0)
returns table(org_id uuid,name text,image_url text,public_slug text,owner_name text,owner_email text,contact_name text,contact_email text,total_count bigint)
language plpgsql stable security definer set search_path='' as $$
declare query_text text; query_key text; query_tokens text[]; browse boolean;
begin
 if not public.has_workspace_support_access() then raise exception 'Workspace support access denied' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid search page'; end if;
 query_text:=lower(left(trim(coalesce(p_query,'')),100));
 query_key:=public.workspace_support_search_key(query_text);
 if p_org is null and length(query_key)<2 then return; end if;
 query_tokens:=array_remove(regexp_split_to_array(query_text,'[^[:alnum:]]+'),'');
 browse:=query_key in ('org','orgs','organization','organizations','organisation','organisations');
 return query
 with directory as (
  select o.user_id as organization_id,
   coalesce(nullif(trim(o.profile->>'name'),''),nullif(trim(o.public_slug),''),'Unnamed organization') as organization_name,
   coalesce(o.profile->>'logoUrl',o.profile->>'logo_url',o.profile->>'brandMarkUrl') as organization_image,
   o.public_slug as organization_slug,
   coalesce(nullif(trim(pr.full_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),
    nullif(trim(concat_ws(' ',u.raw_user_meta_data->>'first_name',u.raw_user_meta_data->>'last_name')),'')) as account_name,
   u.email::text as account_email,
   coalesce(people.search_text,'') as member_search_text
  from public.organizations o
  left join auth.users u on u.id=o.user_id
  left join public.profiles pr on pr.id=o.user_id
  left join lateral (
   select string_agg(concat_ws(' ',mp.full_name,mu.raw_user_meta_data->>'full_name',
     mu.raw_user_meta_data->>'first_name',mu.raw_user_meta_data->>'last_name',mu.email),' ') as search_text
   from public.organization_memberships m join auth.users mu on mu.id=m.member_id
   left join public.profiles mp on mp.id=mu.id where m.org_id=o.user_id
  ) people on true
  where p_org is null or o.user_id=p_org
 ), searchable as (
  select d.*,lower(concat_ws(' ',d.organization_name,d.organization_slug,d.account_name,d.account_email,d.member_search_text)) as search_text
  from directory d
 ), matched as (
  select d.*,
   case when lower(d.account_email)=query_text then 0
    when lower(d.organization_name)=query_text then 1
    when lower(d.account_name)=query_text then 2
    when starts_with(lower(coalesce(d.account_email,'')),query_text) then 3
    when starts_with(lower(d.organization_name),query_text) then 4
    when position(query_text in lower(coalesce(d.account_name,'')))>0 then 5
    when position(query_text in lower(d.organization_name))>0 then 6
    when not browse then 7 else 8 end as search_rank
  from searchable d
  where p_org is not null or browse
   or position(query_key in public.workspace_support_search_key(d.search_text))>0
   or not exists(select 1 from unnest(query_tokens) token where position(token in d.search_text)=0)
 ), ranked as (
  select d.*,count(*) over() as match_count from matched d
 )
 select d.organization_id,d.organization_name,d.organization_image,d.organization_slug,d.account_name,d.account_email,
  coalesce(person.person_name,d.account_name),coalesce(person.person_email,d.account_email),d.match_count
 from ranked d
 left join lateral (
  select coalesce(nullif(trim(mp.full_name),''),nullif(trim(mu.raw_user_meta_data->>'full_name'),''),
    nullif(trim(concat_ws(' ',mu.raw_user_meta_data->>'first_name',mu.raw_user_meta_data->>'last_name')),'')) as person_name,
   mu.email::text as person_email
  from public.organization_memberships m join auth.users mu on mu.id=m.member_id
  left join public.profiles mp on mp.id=mu.id
  where m.org_id=d.organization_id and p_org is null and not browse
   and (position(query_key in public.workspace_support_search_key(concat_ws(' ',mp.full_name,
     mu.raw_user_meta_data->>'full_name',mu.raw_user_meta_data->>'first_name',mu.raw_user_meta_data->>'last_name',mu.email)))>0)
  order by (lower(mu.email)=query_text) desc,mu.email,mu.id limit 1
 ) person on true
 order by d.search_rank,lower(d.organization_name),d.organization_id limit 20 offset p_offset;
end $$;
revoke all on function public.search_workspace_support_organizations_v2(text,uuid,integer) from public,anon;
grant execute on function public.search_workspace_support_organizations_v2(text,uuid,integer) to authenticated;

-- Old deployed callers gain email/name matching without requiring a simultaneous
-- application release. Its return shape and explicit-target behavior stay stable.
create or replace function public.search_workspace_support_organizations(p_query text,p_org uuid default null)
returns table(org_id uuid,name text,image_url text,public_slug text)
language sql stable security definer set search_path='' as $$
 select r.org_id,r.name,r.image_url,r.public_slug from public.search_workspace_support_organizations_v2(p_query,p_org,0) r;
$$;
revoke all on function public.search_workspace_support_organizations(text,uuid) from public,anon;
grant execute on function public.search_workspace_support_organizations(text,uuid) to authenticated;
