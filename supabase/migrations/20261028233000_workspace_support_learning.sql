-- Learning remains personal for ordinary members. Explicit support grants may
-- read the selected organization's owner record and edit with fresh presence.
-- No records are seeded, reassigned, deleted, or marked complete.
do $$ declare target_table text; begin
  foreach target_table in array array['module_progress', 'assignment_submissions'] loop
    execute format('create policy workspace_support_learning_read on public.%I for select to authenticated using (public.workspace_supports_org(user_id))', target_table);
    execute format('create policy workspace_support_learning_insert on public.%I for insert to authenticated with check (public.workspace_support_can_write(user_id))', target_table);
    execute format('create policy workspace_support_learning_update on public.%I for update to authenticated using (public.workspace_support_can_write(user_id)) with check (public.workspace_support_can_write(user_id))', target_table);
    execute format('create trigger workspace_support_learning_audit after insert or update on public.%I for each row execute function public.audit_workspace_support_write()', target_table);
  end loop;
end $$;
