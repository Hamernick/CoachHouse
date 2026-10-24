-- Financial history never exposes prompts, proposals, source bodies or provider IDs.
create function public.read_workspace_ai_usage(p_org_id uuid,p_actor_id uuid,p_member_id uuid default null,
  p_task text default null,p_before_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; members jsonb; more boolean;
begin
  if not public.can_use_workspace_ai(p_org_id,p_actor_id) then raise exception 'AI access denied' using errcode='42501'; end if;
  if p_actor_id<>p_org_id and p_member_id is not null and p_member_id<>p_actor_id then raise exception 'Usage access denied' using errcode='42501'; end if;
  if p_task is not null and p_task not in ('document','plan') then raise exception 'Invalid usage filter'; end if;
  if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid usage cursor'; end if;
  select coalesce(jsonb_agg(to_jsonb(item) order by item.created_at desc,item.id desc),'[]') into rows from (
    select r.id,r.created_at,r.status,r.task,r.charged_credits,r.max_credits,
      r.actor_id "actorId",coalesce(nullif(trim(p.full_name),''),'Organization member') "actorName",
      -- Only the author receives their saved title/reference. Billing authority
      -- alone does not authorize another member's private source context.
      case when r.actor_id=p_actor_id then left(coalesce(r.target->>'title',''),200) else null end "resourceTitle",
      case when r.actor_id=p_actor_id and r.task='document' and not(r.target ? 'selection')
        then r.target->>'sectionId' else null end "sectionId"
    from public.workspace_ai_runs r left join public.profiles p on p.id=r.actor_id
    where r.org_id=p_org_id and (p_actor_id=p_org_id or r.actor_id=p_actor_id)
      and (p_member_id is null or r.actor_id=p_member_id) and (p_task is null or r.task=p_task)
      and (p_before_at is null or (r.created_at,r.id)<(p_before_at,p_before_id))
    order by r.created_at desc,r.id desc limit 21
  ) item;
  more:=jsonb_array_length(rows)>20;
  if more then rows:=rows-20; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.actor_id,'name',coalesce(nullif(trim(p.full_name),''),'Organization member')) order by p.full_name,m.actor_id),'[]')
    into members from (select distinct actor_id from public.workspace_ai_runs where org_id=p_org_id and (p_actor_id=p_org_id or actor_id=p_actor_id)) m
    left join public.profiles p on p.id=m.actor_id;
  return jsonb_build_object('canFilterMembers',p_actor_id=p_org_id,'members',members,'rows',rows,'hasMore',more);
end $$;
revoke all on function public.read_workspace_ai_usage(uuid,uuid,uuid,text,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.read_workspace_ai_usage(uuid,uuid,uuid,text,timestamptz,uuid) to service_role;
