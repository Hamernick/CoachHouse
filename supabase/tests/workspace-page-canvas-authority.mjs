import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { join } from 'node:path'

/** Actual canvas, page RLS, guest and asset bodies. The legacy commit delegate
 * and public-slug reader are controlled prerequisites, not full-schema proof. */
export async function verifyWorkspacePageCanvasAuthority({ postgresDirectory, port, socketDirectory }) {
  const args=['-XqAt','-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  const run=query=>spawnSync(join(postgresDirectory,'psql'),args,{input:query,encoding:'utf8'})
  const sql=query=>{const result=run(query);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
  const denied=(query,pattern=/Page management unavailable|Page unavailable|permission denied/)=>{
    const result=run(query);assert.notEqual(result.status,0);assert.match(result.stderr,pattern)
  }
  const file=name=>readFileSync(`supabase/migrations/${name}.sql`,'utf8')
  const id=n=>`99100000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const owner=id(1),admin=id(2),viewer=id(3),manager=id(4),guest=id(5),canvas=id(10),page=id(20),asset=id(30)
  const context=actor=>`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
  sql(file('20261016183000_workspace_page_membership'))
  sql(`alter table organization_workspace_pages add column canvas_id uuid,add column guest_snapshot jsonb,
    add column last_operation_id uuid,add column last_operation_actor uuid,add column last_operation_hash text;
    alter table auth.users add column email text,add column email_confirmed_at timestamptz;`)
  const guestSql=file('20261031220000_workspace_page_guests')
  sql(guestSql.slice(guestSql.indexOf('create table public.workspace_page_invitations'),guestSql.lastIndexOf('commit;')))
  sql(`alter function workspace_page_guest_command(uuid,uuid,jsonb,text) rename to workspace_page_guest_command_before_closure;
    create function workspace_page_guest_command(p_actor_id uuid,p_page_id uuid,p_command jsonb,p_hash text) returns jsonb
    language sql security definer as $$select public.workspace_page_guest_command_before_closure(p_actor_id,p_page_id,p_command,p_hash)$$;
    create table workspace_page_document_grants(id uuid,org_id uuid,page_id uuid,storage_path text,sha256 text,size_bytes integer);
    create table workspace_page_image_grants(like workspace_page_document_grants);
    create function read_workspace_page_public(text,uuid) returns jsonb language sql security definer as $$
      select jsonb_build_object('snapshot',published_snapshot) from public.organization_workspace_pages where link_id=$2 and visibility='public'$$;`)
  const doc=file('20261101130000_workspace_page_documents')
  sql(doc.slice(doc.indexOf('create function public.read_workspace_page_document('),doc.indexOf('create or replace function public.workspace_page_image_orphans')))
  sql(`alter function read_workspace_page_document(uuid,text,uuid) rename to read_workspace_page_document_before_closure;`)
  const image=file('20261103200000_workspace_page_logo_grants')
  sql(image.slice(image.indexOf('create or replace function public.read_workspace_page_image_before_closure'),image.lastIndexOf('commit;')))
  // Compile the current production outer commit body against a recorded delegate.
  // The delegate never handles authorization; actual outer checks must do that.
  const commit=file('20261106170000_workspace_page_source_permissions')
  const signature=commit.slice(commit.indexOf('create or replace function'),commit.indexOf(') returns jsonb')+1)
  sql(`${signature.replace('commit_workspace_page(', 'commit_workspace_page_before_closure(')} returns jsonb language sql as $$
    select jsonb_build_object('page',to_jsonb(p),'replayed',true) from public.organization_workspace_pages p where id=p_page_id$$;
    create or replace function guard_organization_closure(uuid) returns void language sql as $$select$$;`)
  sql(commit)
  sql(file('20261107190000_workspace_page_canvas_authority'))
  sql(`insert into profiles values('${owner}','member'),('${admin}','member'),('${viewer}','member'),('${manager}','member'),('${guest}','member');
    insert into organizations(user_id) values('${owner}');
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${admin}','admin'),('${owner}','${viewer}','staff'),('${owner}','${manager}','staff');
    insert into auth.users(id,email,email_confirmed_at) select id,id::text||'@example.test',now() from profiles where id in ('${owner}','${admin}','${viewer}','${manager}','${guest}');
    insert into organization_workspace_boards values('${owner}','{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}');`)
  const audience=(revision,members)=>`${context(owner)}select set_workspace_source_audience('${owner}','${canvas}','${owner}',${revision},'${JSON.stringify(members)}');`
  sql(audience(0,[{memberId:viewer,capability:'view'},{memberId:manager,capability:'manage'}]))
  sql(`update workspace_source_audiences set canvas_private=true where org_id='${owner}';
    insert into organization_workspace_pages(id,org_id,canvas_id,title,particle_ids,visibility,published_at,published_snapshot,guest_snapshot)
    values('${page}','${owner}','${canvas}','Private draft',array['${id(40)}'::uuid],'public',now(),
    '{"brand":{"organizationSlug":"fixture"},"items":[{"content":{"kind":"document","assetId":"${asset}"}},{"content":{"kind":"image","assetId":"${asset}"}}]}',
    '{"title":"Reviewed guest copy","items":[{"content":{"kind":"document","assetId":"${asset}"}},{"content":{"kind":"image","assetId":"${asset}"}}]}');
    insert into workspace_page_document_grants values('${asset}','${owner}','${page}','approved-copy','${'a'.repeat(64)}',10);
    insert into workspace_page_image_grants select * from workspace_page_document_grants;
    insert into workspace_page_invitations(id,page_id,email,permission,invited_by,accepted_by,accepted_at)
    values('${id(50)}','${page}','admin@example.test','view','${owner}','${admin}',now()),
      ('${id(51)}','${page}','guest@example.test','manage','${owner}','${guest}',now());`)
  const manage=actor=>sql(`${context(actor)}select filter_workspace_page_management_canvases('${owner}','${actor}',array['${canvas}']);`)
  assert.equal(manage(owner),`{${canvas}}`);assert.equal(manage(manager),`{${canvas}}`)
  assert.equal(manage(viewer),'{}');assert.equal(manage(admin),'{}')
  denied(`${context(admin)}select filter_workspace_page_management_canvases('${owner}','${owner}',array['${canvas}']);`,/Verified page actor/)
  denied(`set role authenticated;select filter_workspace_page_management_canvases('${owner}','${owner}',array['${canvas}']);`)
  denied(`${context(owner)}select filter_workspace_page_management_canvases('${owner}','${owner}',array_fill('default'::text,array[51]));`,/Invalid page canvases/)
  for(const actor of [admin,viewer,manager,owner]) {
    assert.equal(sql(`set role authenticated;set request.jwt.claim.sub='${actor}';select count(*) from organization_workspace_pages;`),[owner,manager].includes(actor)?'1':'0')
  }
  const access=actor=>JSON.parse(sql(`${context(actor)}select public.workspace_page_guest_command_before_closure('${actor}','${page}','{"action":"read"}',null);`))
  assert.equal(access(admin).permission,'view');assert.equal(access(admin).draft,null);assert.equal(access(admin).canGrantManage,false)
  assert.equal(access(guest).permission,'manage');assert.equal(access(guest).canGrantManage,false)
  assert.equal(access(manager).canGrantManage,true)
  denied(`${context(viewer)}select public.workspace_page_guest_command_before_closure('${viewer}','${page}','{"action":"read"}',null);`)
  for(const kind of ['document','image']) {
    const read=(audience,actor=admin)=>sql(`select read_workspace_page_${kind}_before_closure('${asset}','${audience}','${actor}');`)
    assert.equal(read('editor'),'');assert.equal(read('editor',viewer),'')
    assert.ok(read('editor',owner).includes('approved-copy'))
    assert.ok(read('public').includes('approved-copy'))
    assert.ok(read('guest').includes('approved-copy'))
  }
  const save=actor=>`${context(actor)}select commit_workspace_page('${actor}','${owner}','${page}','${id(60)}',repeat('a',64),1,'make_private',null,null,null,null,'[]',null,'${canvas}');`
  denied(save(admin));denied(save(viewer));assert.ok(sql(save(owner)).includes('replayed'))
  sql(`insert into organization_projects(id,org_id,name,created_by,updated_by,status,start_date,end_date,recurrence,recurrence_anchor_start,recurrence_anchor_end)
    values('${id(70)}','${owner}','Sharing fixture','${owner}','${owner}','active','2027-01-01','2027-01-31','monthly','2027-01-01','2027-01-31');
    select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"create","name":"Private sources"}','${id(71)}') from organization_projects where id='${id(70)}';
    select set_project_asset_folder_access('${id(70)}','${id(71)}','${owner}',0,'restricted','[]');
    ${context(owner)}select set_project_folder_workspace_grants('${id(70)}','${id(71)}','${owner}',1,'[{"canvasId":"${canvas}","capability":"view","revision":1}]');`)
  // A deleted canvas is not an authorization reset. Retain exact audience and
  // let authorized managers withdraw the old copy without reading its sources.
  sql(`${context(owner)}update organization_workspace_boards set state='{}' where org_id='${owner}';`)
  assert.equal(manage(owner),`{${canvas}}`);assert.equal(manage(manager),`{${canvas}}`);assert.equal(manage(admin),'{}')
  assert.equal(sql(`select count(*) from project_folder_workspace_grants where org_id='${owner}';`),'0','Deleted-canvas folder grants are removed')
  assert.ok(sql(save(manager)).includes('replayed'))
  assert.equal(sql(`select workspace_source_actor_can('${owner}','${canvas}','${manager}','view');`),'f','Retained page authority does not grant deleted workspace source access')
  sql(`delete from organization_memberships where org_id='${owner}' and member_id='${manager}';
    insert into organization_memberships(org_id,member_id,role) values('${owner}','${manager}','staff');`)
  assert.equal(manage(manager),'{}','Rejoined membership cannot resurrect management')
  // Actual organization lock admission: revoke wins while commit is waiting.
  const restore=`${context(owner)}update organization_workspace_boards set state='{"workspaceCatalog":{"version":1,"defaultName":"Main","entries":[{"id":"${canvas}","name":"Private","state":{}}]}}' where org_id='${owner}';`
  sql(restore);sql(audience(2,[{memberId:manager,capability:'manage'}]))
  let signal;const locked=new Promise(resolve=>{signal=resolve})
  const revoke=new Promise((resolve,reject)=>{
    const child=spawn(join(postgresDirectory,'psql'),args);let out='',err=''
    child.stdout.on('data',data=>{out+=data;if(out.includes('locked'))signal()});child.stderr.on('data',data=>{err+=data})
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(err)))
    child.stdin.end(`begin;${audience(3,[])}select 'locked';select pg_sleep(0.3);commit;`)
  })
  await Promise.race([locked,revoke.then(()=>{throw new Error('Missing lock marker')})])
  denied(save(manager));await revoke
  assert.equal(access(guest).permission,'manage','Explicit guest audience is independent after revoke')
  console.log('[workspace-page-canvas-authority] RLS, bounded disclosure, verified actor, capabilities, independent guest/public copies, copied assets, deleted-canvas recovery, rejoin and revoke-before-commit passed. Controlled commit delegate; full-schema release proof remains.')
}
