create table public.module_progress(user_id uuid references auth.users(id),module_id uuid,status text,notes jsonb,primary key(user_id,module_id));
create table public.assignment_submissions(user_id uuid references auth.users(id),module_id uuid,status text,answers jsonb,primary key(user_id,module_id));
do $$ declare target_table text; begin
 foreach target_table in array array['module_progress','assignment_submissions'] loop
  execute format('alter table public.%I enable row level security',target_table);
  execute format('grant select,insert,update,delete on public.%I to authenticated',target_table);
  execute format('create policy own_learning on public.%I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',target_table);
 end loop;
end $$;
