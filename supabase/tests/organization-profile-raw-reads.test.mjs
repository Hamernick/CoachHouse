import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
const root = mkdtempSync(join(tmpdir(), 'ch-profile-raw-reads-'))
const run = (cmd, args, input) => {
 const result = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
 assert.equal(result.status, 0, result.stderr || result.stdout)
 return result.stdout.trim()
}
const port = await new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)) }) })
const data = join(root, 'data')
let started = false
try {
 run('initdb', ['-D', data, '--auth=trust', '--no-locale', '-E', 'UTF8'])
 run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${root}`, '-w', 'start']); started = true
 const sql = query => run('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', `postgresql://127.0.0.1:${port}/postgres?gssencmode=disable`], query)
 const org='10000000-0000-4000-8000-000000000001', member='10000000-0000-4000-8000-000000000002', outsider='10000000-0000-4000-8000-000000000003'
 sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,banned_until timestamptz);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 create table organizations(user_id uuid primary key,profile jsonb,is_public boolean default true,is_public_roadmap boolean default true,public_slug text,closed boolean default false);
 create table organization_memberships(org_id uuid,member_id uuid,role text);
 create table platform_staff_members(user_id uuid,access_level text);
 create table workspace_support_grants(user_id uuid,revoked_at timestamptz);
 grant select,update on organizations to anon,authenticated,service_role;
 grant select on organization_memberships to authenticated,anon;
 alter table organizations enable row level security;
 create function organization_closure_read_window(uuid) returns boolean language sql stable security definer set search_path='' as $$select not closed from public.organizations where user_id=$1$$;
 create policy organization_closure_read on organizations as restrictive for select to anon,authenticated using(organization_closure_read_window(user_id));
 insert into auth.users values('${org}',null),('${member}',null),('${outsider}',null);
 insert into organizations(user_id,profile,public_slug) values('${org}','{"name":"Published organization","privateBody":"private-needle"}','public-fixture');
 insert into organization_memberships values('${org}','${member}','member');`)
 const staff=readFileSync('supabase/migrations/20260721121500_add_platform_staff_access.sql','utf8')
 const start=staff.indexOf('create or replace function public.is_admin()')
 sql(staff.slice(start,staff.indexOf('$$;',start)+3))
 const support=readFileSync('supabase/migrations/20261014190000_workspace_support_access.sql','utf8')
 sql(support.slice(support.indexOf('create function public.has_workspace_support_access()'),support.indexOf('create function public.workspace_support_can_write')))
 const policies=readFileSync('supabase/migrations/20260115220000_multi_account_org_access.sql','utf8')
 sql(policies.slice(policies.indexOf('create policy "organizations_select"'),policies.indexOf('create policy "organizations_insert"')))
 sql('create policy workspace_support_read on organizations for select to authenticated using(public.workspace_supports_org(user_id));')
 const read=(role,actor='')=>sql(`set request.jwt.claim.sub='${actor}';set role ${role};select count(*) from organizations where profile->>'privateBody'='private-needle';`)
 assert.equal(read('anon'),'1','Fixture reproduces the published raw-profile leak')
 assert.equal(read('authenticated',outsider),'1')
 sql(readFileSync('supabase/migrations/20261107090000_organization_profile_raw_read_scope.sql','utf8'))
 assert.equal(read('anon'),'0')
 assert.equal(read('authenticated',outsider),'0')
 assert.equal(read('authenticated'),'0','No authenticated identity grants no row')
 assert.equal(read('authenticated',org),'1','Owner retains access')
 for(const role of ['owner','admin','staff','board','member']) {
  sql(`update organization_memberships set role='${role}' where member_id='${member}';`)
  assert.equal(read('authenticated',member),'1',role)
 }
 sql(`delete from organization_memberships where member_id='${member}';`)
 assert.equal(read('authenticated',member),'0','Public flags cannot restore revoked membership')
 assert.equal(read('service_role'),'1','Existing server public projections keep canonical read access')
 sql(`insert into platform_staff_members values('${outsider}','developer');`)
 assert.equal(read('authenticated',outsider),'1')
 sql(`update platform_staff_members set access_level='coach';`)
 assert.equal(read('authenticated',outsider),'0','Coach alone is not explicit support authority')
 sql(`insert into workspace_support_grants values('${outsider}',null);`)
 const supportRead=target=>sql(`set request.jwt.claim.sub='${outsider}';set request.headers='{"x-coach-house-organization-id":"${target}"}';set role authenticated;select count(*) from organizations;`)
 assert.equal(supportRead(org),'1')
 assert.equal(supportRead(member),'0')
 sql(`update workspace_support_grants set revoked_at=now();`)
 assert.equal(supportRead(org),'0')
 sql(`update workspace_support_grants set revoked_at=null;update auth.users set banned_until=now()+interval '1 day' where id='${outsider}';`)
 assert.equal(supportRead(org),'0')
 sql(`update organizations set closed=true;`)
 assert.equal(read('authenticated',org),'0','Existing closure restriction still applies')
 sql(`update organizations set closed=false;create policy future_public_read on organizations for select to anon,authenticated using(true);`)
 assert.equal(read('anon'),'0','Additional permissive policies cannot bypass the restriction')
 assert.equal(read('authenticated',member),'0')
 sql('create policy owner_update on organizations for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());')
 assert.equal(sql(`set request.jwt.claim.sub='${org}';set role authenticated;update organizations set profile=jsonb_set(profile,'{name}','"Updated"') where user_id='${org}' returning profile->>'name';`),'Updated','Owner save and RETURNING remain usable')
 console.log('Passed: reproduced public-flag raw JSON leak, anon/nonmember/revoked denial, all member roles, owner/developer/support/closure authority, service projection read, restrictive-policy resilience and owner UPDATE RETURNING. Controlled prerequisites; not full-schema qualification.')
} finally {
 if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
 rmSync(root, { recursive: true, force: true })
}
