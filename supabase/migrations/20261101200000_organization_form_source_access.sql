-- Access targets the canonical saved form before or after publication.
-- No version, public page, answer, ownership or grant is created by reading access.
create or replace function public.organization_form_review_access(p_actor_id uuid,p_command jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
<<access>>
declare
 v public.organization_form_versions%rowtype; f public.organization_forms%rowtype;
 previous public.organization_form_access_operations%rowtype; member uuid; member_role text;
 canonical boolean; delegated public.organization_form_reviewers%rowtype;
 action text:=p_command->>'action'; rows jsonb; n integer; hash text;
begin
 if p_command ? 'versionId' and (p_command ? 'organizationId' or p_command ? 'formId') then
   raise exception 'Choose one form target' using errcode='22023';
 end if;
 if not (p_command ? 'versionId') then
   select org_id,id into v.org_id,v.form_id from public.organization_forms
     where org_id=(p_command->>'organizationId')::uuid and id=(p_command->>'formId')::uuid;
 else
   select * into v from public.organization_form_versions where id=(p_command->>'versionId')::uuid;
 end if;
 if v.org_id is null or p_actor_id is null then raise exception 'Form access required' using errcode='42501'; end if;
 perform 1 from public.organizations where user_id=v.org_id for share;
 if p_actor_id<>v.org_id then
   select role into member_role from public.organization_memberships where org_id=v.org_id and member_id=p_actor_id for share;
   if member_role is null or member_role not in ('owner','admin','staff') then raise exception 'Form access required' using errcode='42501'; end if;
 end if;
 -- Lock target membership before form, matching response/recovery order.
 if action='grant_reviewer' then
   select m.member_id into member from public.organization_memberships m join auth.users u on u.id=m.member_id
     where m.org_id=v.org_id and m.role in ('owner','admin','staff') and u.email_confirmed_at is not null
       and lower(u.email)=lower(trim(p_command->>'email')) for share of m;
 elsif action='revoke_reviewer' then
   member:=(p_command->>'memberId')::uuid;
   perform 1 from public.organization_memberships where org_id=v.org_id and member_id=member for share;
 end if;
 select * into f from public.organization_forms where org_id=v.org_id and id=v.form_id for update;
 if action='source_access' then
   return jsonb_build_object('formId',f.id,'canEdit',public.can_edit_organization_form(f.org_id,f.id,p_actor_id),
     'canManageAccess',public.can_manage_organization_form(f.org_id,f.id,p_actor_id));
 end if;
 canonical:=f.intake_manager=p_actor_id;
 if not public.can_manage_organization_form(f.org_id,f.id,p_actor_id) then raise exception 'Form manager required' using errcode='42501'; end if;
 if action='review_access' then
   select coalesce(jsonb_agg(jsonb_build_object('id',g.member_id,'email',coalesce(u.email,'Unavailable account'),'role',g.role) order by g.member_id),'[]'),count(*) into rows,n
     from public.organization_form_reviewers g join auth.users u on u.id=g.member_id
     where g.org_id=v.org_id and g.form_id=v.form_id and g.manager_revision=f.manager_revision and (canonical or g.granted_by=p_actor_id);
   return jsonb_build_object('formId',v.form_id,'revision',f.access_revision,'canGrantManage',canonical,'reviewers',rows);
 end if;
 if action not in ('grant_reviewer','revoke_reviewer') or p_command->>'operationId' is null
   or (p_command->>'expectedRevision')::integer is null then raise exception 'Invalid access command' using errcode='22023'; end if;
 if action='grant_reviewer' and coalesce(p_command->>'role','view') not in ('view','edit','manage') then
   raise exception 'Invalid form role' using errcode='22023'; end if;
 hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into previous from public.organization_form_access_operations where org_id=v.org_id and operation_id=(p_command->>'operationId')::uuid;
 if found then
   if previous.actor_id<>p_actor_id or previous.operation_hash<>hash then raise exception 'Access operation reused' using errcode='23505'; end if;
   return jsonb_build_object('formId',previous.form_id,'operationId',previous.operation_id,'revision',previous.revision);
 end if;
 if f.access_revision<>(p_command->>'expectedRevision')::integer then raise exception 'Access changed' using errcode='40001'; end if;
 if member is null or member=p_actor_id or member=f.intake_manager then raise exception 'Choose an existing organization editor' using errcode='22023'; end if;
 select * into delegated from public.organization_form_reviewers
   where org_id=v.org_id and form_id=v.form_id and member_id=member and manager_revision=f.manager_revision;
 -- Only the canonical manager may grant Manage or replace another grantor's access.
 if not canonical and ((action='grant_reviewer' and coalesce(p_command->>'role','view')='manage')
   or (delegated.member_id is not null and delegated.granted_by<>p_actor_id)) then
   raise exception 'Access delegation not permitted' using errcode='42501'; end if;
 -- A downgrade/revocation ends its delegation chain. Canonical adoption of a
 -- child grant changes granted_by, so independently retained access survives.
 if delegated.role='manage' and (action='revoke_reviewer' or coalesce(p_command->>'role','view')<>'manage') then
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and granted_by=member;
 end if;
 if action='grant_reviewer' then
   -- Invalidated grants never reappear after manager recovery.
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and manager_revision<>f.manager_revision;
   select count(*) into n from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id;
   if n>=50 and not exists(select 1 from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and member_id=member) then
     raise exception 'Reviewer limit reached' using errcode='54000'; end if;
   insert into public.organization_form_reviewers(org_id,form_id,member_id,manager_revision,granted_by,role)
     values(v.org_id,v.form_id,member,f.manager_revision,p_actor_id,coalesce(p_command->>'role','view'))
     on conflict (org_id,form_id,member_id) do update set role=excluded.role,granted_by=excluded.granted_by;
 else
   delete from public.organization_form_reviewers where org_id=v.org_id and form_id=v.form_id and member_id=member;
   if not found then raise exception 'Access changed' using errcode='40001'; end if;
 end if;
 update public.organization_forms set access_revision=access_revision+1 where org_id=v.org_id and id=v.form_id returning * into f;
 insert into public.organization_form_access_operations(org_id,operation_id,form_id,actor_id,operation_hash,member_id,enabled,revision)
   values(v.org_id,(p_command->>'operationId')::uuid,v.form_id,p_actor_id,hash,member,action='grant_reviewer',f.access_revision);
 return jsonb_build_object('formId',v.form_id,'operationId',p_command->>'operationId','revision',f.access_revision);
end; $$;
revoke all on function public.organization_form_review_access(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.organization_form_review_access(uuid,jsonb) to service_role;
