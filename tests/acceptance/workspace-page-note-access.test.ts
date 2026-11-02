import {spawn} from "node:child_process"
import {afterAll,beforeEach,describe,expect,it,vi} from "vitest"
import {createClosureDatabaseHarness,databaseUrl} from "./organization-closure-database-helpers"
import {runPageNoteCommand} from "@/features/workspace-sharing/server/page-note-access"
import type {PageNoteCommand} from "@/features/workspace-sharing/lib/page-note-access"
import {noteFixtureId as id,noteFixtureQuote as quote,noteFixturePage as pageId,noteFixtureParticle as particleId,noteFixtureCanvas as canvasId,seedPageNoteFixture,noteFixtureGraph} from "./fixtures/workspace-page-note-source"
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({rpc:mocks.rpc})}))
const db=createClosureDatabaseHarness(spawn)
const read={action:"read" as const,pageId,particleId},list={action:"list" as const,pageId}
const enable=(revision=1,operation=7020)=>({action:"set_scope" as const,pageId,particleId,operationId:id(operation),expectedPageRevision:revision,expectedNoteRevision:1,enabled:true})
const write=(operation=7030)=>({action:"write" as const,pageId,particleId,operationId:id(operation),expectedNoteRevision:1,content:"Changed source",html:"<p>Changed <strong>source</strong><script>unsafe()</script></p>"})
const sql=(actor:number,command:unknown,hash="b".repeat(64))=>`select public.workspace_page_note_command('${id(actor)}','${pageId}',${quote(command)},'${hash}')`
async function run(command:PageNoteCommand=list,actor=2){return runPageNoteCommand(id(actor),command)}
describe.skipIf(!databaseUrl)("explicit selected-note guest source editing with canonical Particle preparation and actual SQL",()=>{
 beforeEach(async()=>{
  await seedPageNoteFixture(db.query)
  mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
   expect(name).toBe("workspace_page_note_command")
   const result=await db.query(`\\set VERBOSITY verbose\nset role service_role;select public.workspace_page_note_command('${args.p_actor_id}','${args.p_page_id}',${quote(args.p_command)},'${args.p_hash}',${args.p_expected_graph?quote(args.p_expected_graph):"null"},${args.p_next_graph?quote(args.p_next_graph):"null"})`)
   const errorCode=result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]
   if(result.code!==0&&!['42501','40001','22023','23505','55P03'].includes(errorCode??''))throw new Error(result.stderr)
   return result.code===0?{data:JSON.parse(result.stdout.trim()),error:null}:{data:null,error:{code:result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??"XX000",message:result.stderr}}
  })
 })
 afterAll(()=>{for(const child of db.clients)child.kill()})
 it("rejects oversized sanitized content before dispatch without uncertain recovery",async()=>{
  mocks.rpc.mockClear()
  await expect(run({...write(),content:"x",html:`<p>${"a".repeat(20001)}</p>`})).rejects.toMatchObject({code:"invalid",uncertain:false})
  expect(mocks.rpc).not.toHaveBeenCalled()
 })
 it("keeps existing invitations page-only and permits only org editors to explicitly review and enable full note fields",async()=>{
  expect((await run()).notes).toEqual([])
  await expect(run(read)).rejects.toMatchObject({code:"scope"});await expect(run(enable())).rejects.toMatchObject({code:"scope"})
  const reviewed=await run({action:"review_scope",pageId,particleId},1);expect(reviewed.note?.content).toBe("Shared source")
  expect(JSON.stringify(reviewed)).not.toContain("Unrelated private");expect(reviewed).not.toHaveProperty("graph")
  await run(enable(),1);expect((await run(read)).note?.content).toBe("Shared source")
  await expect(run({...read,particleId:id(7002)})).rejects.toMatchObject({code:"scope"})
  await expect(run(read,13)).rejects.toMatchObject({code:"scope"})
  expect((await db.query(`set role authenticated;${sql(2,{action:"read",particleId})}`)).code).not.toBe(0)
 })
 it("edits the original note through the canonical writer, sanitizes HTML, and preserves other references, fields and snapshots",async()=>{
  await run(enable(),1);const saved=await run(write());expect(saved.note?.content).toBe("Changed source");expect(saved.note?.revision).toBe(2);expect(saved.note?.html).not.toContain("script")
  const state=await db.query(`select state from public.organization_workspace_boards where org_id='${id(1)}'`);const stored=JSON.parse(state.stdout.trim())
  expect(stored.particleGraph.particles[0].data.widget.source.content).toBe("Changed source")
  expect(stored.particleGraph.particles[1]).toEqual(noteFixtureGraph().particles[1]);expect(stored.unrelatedField).toBe("keep")
  expect(stored.workspaceCatalog.entries[0].state.particleGraph.particles[0].data.widget.source.content).toBe("Named source")
  const snapshots=await db.query(`select guest_snapshot#>>'{items,0,content,markdown}',published_snapshot#>>'{items,0,content,markdown}' from public.organization_workspace_pages where id='${pageId}'`)
  expect(snapshots.stdout.trim()).toBe("Shared source|Shared source")
  const receipts=await db.query("select actor_id,action from public.workspace_page_note_receipts order by action")
  expect(receipts.stdout).toContain(`${id(2)}|write`)
 })
 it("rejects stale content and reconciles identical lost replies without repeating a source mutation",async()=>{
  await run(enable(),1);await run(write());expect((await run(write())).replayed).toBe(true)
  await expect(run({...write(7031),content:"Stale",html:undefined})).rejects.toMatchObject({code:"conflict"})
  await expect(run({...write(),content:"Different",html:undefined})).rejects.toMatchObject({code:"invalid"})
  const revision=await db.query(`select state#>>'{particleGraph,revision}' from public.organization_workspace_boards where org_id='${id(1)}'`);expect(revision.stdout.trim()).toBe("2")
 })
 it("revokes source editing immediately, including prior receipt replay, without revoking other page access",async()=>{
  await run(enable(),1);await run(write())
  await run({...enable(3,7040),enabled:false,expectedNoteRevision:2},1)
  await expect(run(read)).rejects.toMatchObject({code:"scope"});await expect(run(write())).rejects.toMatchObject({code:"scope"})
  const page=await db.query(`select public.workspace_page_guest_command('${id(2)}','${pageId}','{"action":"read"}',null)`);expect(page.code,page.stderr).toBe(0)
 })
 it("never revives a removed source or selection even if its exact ID and createdAt are restored",async()=>{
  await run(enable(),1)
  const graph=noteFixtureGraph();const remove=await db.query(`update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',${quote([graph.particles[1]])}),updated_by='${id(1)}' where org_id='${id(1)}';update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph}',${quote(graph)}),updated_by='${id(1)}' where org_id='${id(1)}'`);expect(remove.code,remove.stderr).toBe(0)
  await expect(run(read)).rejects.toMatchObject({code:"scope"});expect((await run(list,1)).notes[0].enabled).toBe(false)
  await run(enable(2,7050),1)
  const selection=await db.query(`update public.organization_workspace_pages set particle_ids=array['${id(7002)}'::uuid] where id='${pageId}';update public.organization_workspace_pages set particle_ids=array['${particleId}'::uuid] where id='${pageId}'`);expect(selection.code,selection.stderr).toBe(0)
  await expect(run(read)).rejects.toMatchObject({code:"scope"})
 })
 it("binds an opt-in to its exact canvas and never redirects it to a restored alternate source",async()=>{
  await run(enable(),1)
  const changed=await db.query(`update public.organization_workspace_pages set canvas_id='${canvasId}' where id='${pageId}'`);expect(changed.code,changed.stderr).toBe(0)
  await expect(run(read)).rejects.toMatchObject({code:"scope"})
  const restore=await db.query(`update public.organization_workspace_pages set canvas_id=null where id='${pageId}'`);expect(restore.code,restore.stderr).toBe(0)
  await expect(run(read)).rejects.toMatchObject({code:"scope"})
 })
 it("edits the explicitly selected named-canvas note while preserving the identical root ID",async()=>{
  const namedPage=id(7080)
  const setup=await db.query(`insert into public.organization_workspace_pages(id,org_id,link_id,canvas_id,title,description,particle_ids,guest_snapshot) select '${namedPage}',org_id,'${namedPage}','${canvasId}',title,description,particle_ids,jsonb_set(guest_snapshot,'{items,0,content,markdown}','"Named source"'::jsonb) from public.organization_workspace_pages where id='${pageId}';
   select public.workspace_page_guest_command('${id(1)}','${namedPage}',${quote({action:"invite",invitationId:id(7081),operationId:id(7082),email:"person2@example.org",permission:"edit"})},repeat('d',64));
   select public.workspace_page_guest_command('${id(2)}','${namedPage}',${quote({action:"accept",invitationId:id(7081)})},null);`);expect(setup.code,setup.stderr).toBe(0)
  await run(enable(),1);await run({...enable(1,7083),pageId:namedPage},1)
  expect((await run({...read,pageId:namedPage})).note?.content).toBe("Named source")
  await run({...write(7084),pageId:namedPage})
  expect((await run(read)).note?.content).toBe("Shared source")
  expect((await run({...read,pageId:namedPage})).note?.content).toBe("Changed source")
 })
 it("fences current reads/writes and privileged scope mutations during closure; cancel never restores a removed opt-in",async()=>{
  await run(enable(),1);await run({...enable(2,7060),enabled:false},1)
  const closed=await db.query("select public.fixture_closure('request',7061,0)");expect(closed.code,closed.stderr).toBe(0)
  await expect(run(read)).rejects.toMatchObject({code:"scope"});await expect(run(write())).rejects.toMatchObject({code:"scope"})
  expect((await db.query("update public.workspace_page_note_scopes set enabled=true")).code).not.toBe(0)
  await db.query("select public.fixture_closure('cancel',7062,1)");await expect(run(read)).rejects.toMatchObject({code:"scope"})
 })
 it("serializes independent grant revocation against source reads and final writes",async()=>{
  await run(enable(),1)
  const release=await db.hold(sql(2,{action:"read",particleId}))
  const revoke=`select public.workspace_page_guest_command('${id(1)}','${pageId}',${quote({action:"revoke",invitationId:id(7010),operationId:id(7070)})},repeat('c',64))`
  await db.blocked(revoke);await release()
  const revoked=await db.hold(revoke),waiting=await db.queued(sql(2,{action:"write",particleId,operationId:id(7071),expectedNoteRevision:1,content:"After revoke"}))
  await revoked();const result=await waiting.result;expect(result.code).not.toBe(0)
 })
})
