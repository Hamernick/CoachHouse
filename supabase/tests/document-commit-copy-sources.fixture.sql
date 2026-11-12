-- Disposable PostgreSQL prerequisites, not a replacement for full-schema qualification.
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key,banned_until timestamptz);
create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
create function public.organization_activity_actor_id() returns uuid language sql as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
create table organizations(user_id uuid primary key,profile jsonb,updated_at timestamptz default clock_timestamp(),closed boolean default false);
create function fixture_revision() returns trigger language plpgsql as $$begin new.updated_at:=clock_timestamp();return new;end$$;
create trigger fixture_revision before update on organizations for each row execute function fixture_revision();
create table profiles(id uuid primary key,role text);
create table organization_memberships(org_id uuid,member_id uuid,role text);
create table platform_staff_members(user_id uuid,access_level text,can_access_unassigned_organizations boolean);
create table workspace_support_grants(user_id uuid,revoked_at timestamptz);
create table subscriptions(user_id uuid);
create table organization_coach_scope_settings(id boolean,assigned_only_enabled boolean);
create table organization_coach_assignments(organization_id uuid,coach_user_id uuid);
create function has_workspace_paid_features(uuid) returns boolean language sql as $$select true$$;
create function native_workspace_document_content(jsonb) returns jsonb language sql as $$select $1$$;
create function guard_organization_closure(uuid) returns void language plpgsql as $$begin
 if exists(select 1 from public.organizations where user_id=$1 and closed) then raise insufficient_privilege;end if;end$$;
create function organization_closure_read_window(uuid) returns boolean language sql as $$select exists(select 1 from public.organizations where user_id=$1 and not closed)$$;
create table workspace_ai_runs(id uuid primary key,org_id uuid,actor_id uuid,task text,target jsonb,status text);
create table workspace_ai_document_applications(run_id uuid primary key references workspace_ai_runs(id) on delete restrict,section_id text);
create function ai_credit_immutable() returns trigger language plpgsql as $$begin raise exception 'Immutable';end$$;
create trigger fixture_receipt_immutable before update or delete on workspace_ai_document_applications for each row execute function ai_credit_immutable();
insert into auth.users values('10000000-0000-4000-8000-000000000001',null),('10000000-0000-4000-8000-000000000002',null);
insert into profiles select id,'member' from auth.users;
insert into organizations(user_id,profile) values('10000000-0000-4000-8000-000000000001',
 '{"unrelated":{"keep":true},"roadmap":{"sections":[{"id":"good","content":"original"},{"id":"bad","content":"blocked"},{"id":"manual","content":"manual"}]}}');
insert into organization_memberships values('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','staff');
