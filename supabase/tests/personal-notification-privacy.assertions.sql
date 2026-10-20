-- Existing task fixture created an admin actor receipt and a coach assignment.
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception '%', message; end if; end;
$$;
select pg_temp.assert_true(exists(select 1 from notifications where type='task_assignment_confirmed'
  and title='You assigned a task to Assigned coach'), 'Actor receipt explicitly names the assignee');
update profiles set role='admin' where id='00000000-0000-4000-8000-000000000001';

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select pg_temp.assert_true(public.is_admin(), 'Exercise the platform admin exception specifically');
select pg_temp.assert_true((select count(*)>0 from notifications), 'Admin retains own inbox');
select pg_temp.assert_true((select count(*)=0 from notifications where user_id<>auth.uid()), 'Admin cannot read other inboxes');
with changed as (update notifications set read_at=now() where user_id<>auth.uid() returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Admin cannot mark others notices read');
with changed as (delete from notifications where user_id<>auth.uid() returning id)
select pg_temp.assert_true((select count(*)=0 from changed), 'Admin cannot delete others notices');
update notifications set read_at=now() where user_id=auth.uid();
select pg_temp.assert_true((select bool_and(read_at is not null) from notifications), 'Own read state remains editable');
do $$ begin
  begin
    update notifications set user_id='00000000-0000-4000-8000-000000000002' where user_id=auth.uid();
    raise exception 'Recipient rewrite unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
select pg_temp.assert_true((select count(*)=1 from notifications), 'Coach sees only own assignment');
select pg_temp.assert_true((select bool_and(read_at is null) from notifications), 'Admin read changes do not affect coach inbox');
delete from notifications where user_id=auth.uid();
select pg_temp.assert_true((select count(*)=0 from notifications), 'Owner may remove own notice');
reset role;

set role service_role;
select pg_temp.assert_true((select count(*)>0 from notifications), 'Trusted service retains delivery and maintenance access');
insert into notifications(user_id,title,description) values
  ('00000000-0000-4000-8000-000000000002','Delivery check','Trusted producer');
reset role;
