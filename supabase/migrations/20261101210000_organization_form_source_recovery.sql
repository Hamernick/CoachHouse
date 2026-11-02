-- Reuse owner-only recovery for saved forms without requiring publication.
begin;
alter table public.organization_form_recoveries alter column page_id drop not null;
comment on column public.organization_form_recoveries.page_id is 'NULL for explicit canonical-source recovery; otherwise the published-page target. Part of exact retry identity.';
create or replace function public.organization_form_recovery(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<recovery>>
declare
 target_org uuid; page_id uuid:=(p_command->>'pageId')::uuid; form_id uuid:=(p_command->>'formId')::uuid;
 action text:=p_command->>'action'; manager uuid; member_role text; current_form public.organization_forms%rowtype;
 previous public.organization_form_recoveries%rowtype; rows jsonb; total integer;
begin
 if page_id is not null then
   if p_command->>'organizationId' is not null then raise exception 'Ambiguous recovery target' using errcode='22023'; end if;
   select org_id into target_org from public.organization_workspace_pages where id=page_id;
 else
   target_org:=(p_command->>'organizationId')::uuid;
   if target_org is null or form_id is null then raise exception 'Recovery target required' using errcode='22023'; end if;
 end if;
 if target_org is null or p_actor_id is distinct from target_org then
   if action='recoverable_forms' then return jsonb_build_object('forms','[]'::jsonb,'next',null); end if;
   raise exception 'Organization owner required' using errcode='42501';
 end if;
 -- Serialize recovery with publication/intake and fence membership insertion via its org FK.
 -- Existing membership role edits are fenced by the membership SHARE lock below.
 perform 1 from public.organizations where user_id=target_org for update;
 if not found then raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 if action='recoverable_forms' then
   select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'),count(*) into rows,total from (
     select f.id, f.manager_revision as revision,
       case when recovery.page_id is not null then
         (select v.version->>'title' from public.organization_form_versions v
           where v.org_id=f.org_id and v.form_id=f.id and v.page_id=recovery.page_id order by v.created_at desc,v.id desc limit 1)
       else (select s.content->>'title' from public.organization_workspace_boards b
         cross join lateral public.workspace_form_sources(b.state) s
         where b.org_id=f.org_id and s.id=f.id limit 1) end as title
     from public.organization_forms f
     where f.org_id=target_org and f.intake_manager<>target_org
       and (p_command->>'after' is null or f.id>(p_command->>'after')::uuid)
       and not exists(select 1 from public.organization_memberships m where m.org_id=f.org_id and m.member_id=f.intake_manager and m.role in ('owner','admin','staff'))
       and ((recovery.page_id is not null and exists(select 1 from public.organization_form_versions v where v.org_id=f.org_id and v.form_id=f.id and v.page_id=recovery.page_id))
         or (recovery.page_id is null and f.id=recovery.form_id and exists(
           select 1 from public.organization_workspace_boards b cross join lateral public.workspace_form_sources(b.state) s
           where b.org_id=f.org_id and s.id=f.id)))
     order by f.id limit 50
   ) t;
   return jsonb_build_object('forms',rows,'next',case when total=50 then rows->49->>'id' else null end);
 end if;
 if action is distinct from 'recover_form' or form_id is null or p_command->>'operationId' is null
   or coalesce((p_command->>'expectedRevision')::integer,0)<1 then
   raise exception 'Invalid recovery request' using errcode='22023'; end if;
 select intake_manager into manager from public.organization_forms where org_id=target_org and id=form_id;
 if not found then raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 select role into member_role from public.organization_memberships where org_id=target_org and member_id=manager for share;
 if page_id is not null then
   perform 1 from public.organization_workspace_pages where id=page_id and org_id=target_org for share;
   if not found or not exists(select 1 from public.organization_form_versions v where v.org_id=target_org and v.form_id=recovery.form_id and v.page_id=recovery.page_id) then
     raise exception 'Form recovery unavailable' using errcode='42501'; end if;
 else
   -- Match the source-writer lock order: board before form. Never recover a deleted source.
   perform 1 from public.organization_workspace_boards where org_id=target_org for share;
   if not exists(select 1 from public.organization_workspace_boards b cross join lateral public.workspace_form_sources(b.state) s
     where b.org_id=target_org and s.id=recovery.form_id) then
     raise exception 'Form source unavailable' using errcode='42501'; end if;
 end if;
 select * into current_form from public.organization_forms f where f.org_id=target_org and f.id=form_id for update;
 select * into previous from public.organization_form_recoveries r where r.org_id=target_org and r.operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.form_id<>form_id or previous.page_id is distinct from page_id
     or previous.expected_revision<>(p_command->>'expectedRevision')::integer then
     raise exception 'Recovery identity reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if current_form.manager_revision<>(p_command->>'expectedRevision')::integer or current_form.intake_manager is distinct from manager then
   raise exception 'Form manager changed' using errcode='40001'; end if;
 if manager=target_org or member_role in ('owner','admin','staff') then
   raise exception 'Form manager still active' using errcode='42501'; end if;
 update public.organization_forms f set intake_manager=p_actor_id,manager_revision=f.manager_revision+1
   where f.org_id=target_org and f.id=form_id returning * into current_form;
 insert into public.organization_form_recoveries(org_id,operation_id,form_id,page_id,actor_id,previous_manager,expected_revision,revision)
   values(target_org,(p_command->>'operationId')::uuid,form_id,page_id,p_actor_id,manager,(p_command->>'expectedRevision')::integer,current_form.manager_revision);
 return jsonb_build_object('formId',form_id,'operationId',p_command->>'operationId','revision',current_form.manager_revision);
end; $$;
revoke all on function public.organization_form_recovery(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_recovery(uuid,jsonb) to service_role;
commit;
