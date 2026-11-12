\set org 'e972bc07-fbf5-4fc8-a416-7f00910a71e2'
\set actor '90b6c688-889c-467f-9edd-166f28bf0819'
set request.jwt.claim.role='service_role';
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
update organization_memberships set role='staff' where org_id=:'org' and member_id=:'actor';
create function pg_temp.board_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'Board assertion: %',label;end if;end;$$;
create function pg_temp.board_denied(command text,code text default '42501') returns void language plpgsql as $$begin
 begin execute command;exception when others then if sqlstate=code then return;end if;raise;end;
 raise exception 'Expected denial %: %',code,command;end;$$;
create temp table board_before as select state,updated_at from organization_workspace_boards where org_id=:'org';
grant select on board_before to service_role;
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'actor')::text,false);
set role service_role;
-- A layout save is independent of hidden siblings; canonical graph stays intact.
select pg_temp.board_check(commit_workspace_board(:'org',:'actor',(select updated_at from board_before),(select state from board_before),(select jsonb_set(state,'{preset}','"calendar-focused"') from board_before)),'Independent layout save');
select pg_temp.board_check(not commit_workspace_board(:'org',:'actor',(select updated_at from board_before),(select state from board_before),(select state from board_before)),'Stale complete snapshot rejected');
reset role;
select pg_temp.board_check((select a.state-'preset'=b.state-'preset' from organization_workspace_boards a cross join board_before b where a.org_id=:'org'),'All unrelated content preserved');
update board_before set state=b.state,updated_at=b.updated_at from organization_workspace_boards b where b.org_id=:'org';
set role service_role;
select pg_temp.board_check(not commit_workspace_board(:'org',:'actor',(select updated_at from board_before),'{}',(select state from board_before)),'Correct timestamp does not authorize partial snapshot');
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'actor',(select updated_at from board_before),(select state from board_before),(select state-'particleGraph' from board_before)));
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'org',(select updated_at from board_before),(select state from board_before),(select state from board_before)));
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,null,%L,%L)',:'org',:'actor','{}','{}'),'22023');
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'actor',(select updated_at from board_before),(select state from board_before),'[]'),'22023');
reset role;
-- Fresh downgrade blocks even layout-only writes; owner retains access.
update organization_memberships set role='member' where org_id=:'org' and member_id=:'actor';
set role service_role;
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'actor',(select updated_at from board_before),(select state from board_before),(select state from board_before)));
select set_config('request.headers',jsonb_build_object('x-coach-house-actor-id',:'org')::text,false);
select pg_temp.board_check(commit_workspace_board(:'org',:'org',(select updated_at from board_before),(select state from board_before),(select state from board_before)),'Owner retains access');
reset role;
update organization_memberships set role='staff' where org_id=:'org' and member_id=:'actor';
update board_before set state=b.state,updated_at=b.updated_at from organization_workspace_boards b where b.org_id=:'org';
-- Closure rejection and initial insert are real operations, rolled back locally.
begin;
select organization_closure_command(:'org',:'org','request','79000000-0000-4000-8000-000000000001',0);
set local role service_role;
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'org',(select updated_at from board_before),(select state from board_before),(select state from board_before)));
rollback;
begin;
delete from organization_workspace_boards where org_id=:'org';
set local role service_role;
select pg_temp.board_check(not commit_workspace_board(:'org',:'org',(select updated_at from board_before),(select state from board_before),'{}'),'Missing board does not revive stale save');
select pg_temp.board_check(commit_workspace_board(:'org',:'org',null,null,'{"nodes":[],"connections":[]}'),'First save inserts');
select pg_temp.board_check(not commit_workspace_board(:'org',:'org',null,null,'{}'),'Concurrent first save cannot overwrite');
rollback;
begin isolation level repeatable read;
set local role service_role;
select pg_temp.board_denied(format('select commit_workspace_board(%L,%L,%L,%L,%L)',:'org',:'org',(select updated_at from board_before),(select state from board_before),(select state from board_before)),'40001');
rollback;
select pg_temp.board_check(not has_function_privilege('authenticated','commit_workspace_board(uuid,uuid,timestamptz,jsonb,jsonb)','execute') and not has_function_privilege('anon','commit_workspace_board(uuid,uuid,timestamptz,jsonb,jsonb)','execute'),'No client bypass');
select pg_temp.board_check((select a.state=b.state from organization_workspace_boards a cross join board_before b where a.org_id=:'org'),'Denied saves preserve state');
