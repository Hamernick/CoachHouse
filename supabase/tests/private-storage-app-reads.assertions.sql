-- Run in a rollback transaction with the migration and two real, temporary
-- Storage API fixtures. Set qualification.org and qualification.paths first.
create function pg_temp.assert_private_read(value boolean, message text)
returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end;
$$;

select pg_temp.assert_private_read(
  (select not polpermissive and polcmd='r' from pg_policy
   where polrelid='storage.objects'::regclass and polname='private_files_app_read_boundary'),
  'The boundary must restrict existing SELECT grants, never replace authorization');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('qualification.org'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('qualification.org'),'role','authenticated')::text, true);
do $$
declare operation text; visible integer;
begin
  foreach operation in array array[
    '', 'object.get_authenticated', 'storage.object.get_authenticated',
    'object.sign', 'object.sign_many', 'object.list', 'object.list_v2',
    'object.get_authenticated_info', 'object.head_authenticated_info',
    'render.image_authenticated', 'object.copy', 'object.move',
    's3.object.get', 's3.object.copy', 's3.upload.part_copy'
  ] loop
    perform set_config('storage.operation',operation,true);
    select count(*) into visible from storage.objects
      where name = any(string_to_array(current_setting('qualification.paths'),','));
    perform pg_temp.assert_private_read(visible=0,'Private read escaped through '||operation);
  end loop;
  foreach operation in array array['object.upload','object.upload_update','object.delete','object.delete_many'] loop
    perform set_config('storage.operation',operation,true);
    select count(*) into visible from storage.objects
      where name = any(string_to_array(current_setting('qualification.paths'),','));
    perform pg_temp.assert_private_read(visible=2,'Authorized write prerequisites lost for '||operation);
  end loop;
end $$;
reset role;

-- A forged operation alone cannot grant a foreign tenant access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000999', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000999","role":"authenticated"}', true);
select set_config('storage.operation','object.upload_update',true);
select pg_temp.assert_private_read(
  not exists(select 1 from storage.objects where name = any(string_to_array(current_setting('qualification.paths'),','))),
  'Existing tenant isolation must still apply to writes');
reset role;
