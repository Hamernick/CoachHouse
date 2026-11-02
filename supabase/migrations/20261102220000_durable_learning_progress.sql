-- Additive: preserve existing notes, submissions and whole-module completion.
alter table public.module_progress add column if not exists step_progress jsonb
  not null default '{"version":1,"completed":{}}'::jsonb;
alter table public.module_progress add constraint module_progress_steps_shape check ((
  jsonb_typeof(step_progress) = 'object' and step_progress->>'version' = '1'
  and jsonb_typeof(step_progress->'completed') = 'object'
  and octet_length(step_progress::text) <= 131072
) is true);

create or replace function public.record_module_step(
  p_user_id uuid, p_module_id uuid, p_step_key text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved jsonb; entry jsonb;
begin
  if auth.uid() is null or p_user_id is null or (p_user_id <> auth.uid() and not public.workspace_support_can_write(p_user_id)) then
    raise exception 'Learning access denied' using errcode = '42501';
  end if;
  if p_step_key is null or length(p_step_key) > 200 or p_step_key !~ '^(lesson|video|resources|assignment(:[a-zA-Z0-9_-]+)?)$' then
    raise exception 'Invalid step' using errcode = '22023';
  end if;
  entry := jsonb_build_object(p_step_key, jsonb_build_object('recordedAt',now(),'actorId',auth.uid()));
  insert into public.module_progress as progress (user_id,module_id,step_progress)
  values (p_user_id,p_module_id,jsonb_build_object('version',1,'completed',entry))
  on conflict (user_id,module_id) do update set step_progress = jsonb_build_object(
    'version',1,'completed',entry || (progress.step_progress->'completed')
  ) returning step_progress into saved;
  return saved;
end $$;
revoke all on function public.record_module_step(uuid,uuid,text) from public,anon;
grant execute on function public.record_module_step(uuid,uuid,text) to authenticated;

-- Compare note content, not updated_at: recording a step must not conflict with notes.
create or replace function public.save_module_notes_if_current(
  p_user_id uuid, p_module_id uuid, p_notes jsonb, p_expected_notes jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved jsonb; wrote boolean;
begin
  if auth.uid() is null or p_user_id is null or (p_user_id <> auth.uid() and not public.workspace_support_can_write(p_user_id)) then
    raise exception 'Learning access denied' using errcode = '42501';
  end if;
  if octet_length(coalesce(p_notes::text,'')) > 131072 then
    raise exception 'Notes too large' using errcode = '22023';
  end if;
  insert into public.module_progress as progress (user_id,module_id,notes)
  select p_user_id,p_module_id,p_notes
  where p_expected_notes is null or exists (
    select 1 from public.module_progress where user_id=p_user_id and module_id=p_module_id
  )
  on conflict (user_id,module_id) do update set notes = excluded.notes
  where progress.notes is not distinct from p_expected_notes or progress.notes is not distinct from p_notes
  returning notes,true into saved,wrote;
  return jsonb_build_object('ok',coalesce(wrote,false),'notes',saved);
end $$;
revoke all on function public.save_module_notes_if_current(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_module_notes_if_current(uuid,uuid,jsonb,jsonb) to authenticated;
