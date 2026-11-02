import {createParticle,emptyParticleGraph} from "@/features/workspace-particles"
export const noteFixtureId=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const id=noteFixtureId
export const noteFixtureQuote=(value:unknown)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`
export const noteFixturePage=id(7000),noteFixtureParticle=id(7001),noteFixtureCanvas=id(7009)
export function noteFixtureGraph(content="Shared source"){
 const now="2026-11-02T00:00:00.000Z"
 const note=createParticle("activity",{workspaceId:id(1),id:noteFixtureParticle,now,title:"Selected note"})
 if(note.type!=="activity")throw new Error("Expected activity")
 const selected={...note,revision:1,data:{...note.data,widget:{kind:"notes" as const,source:{kind:"workspace" as const,content,html:`<p>${content}</p>`}}}}
 const privateNote={...selected,id:id(7002),title:"Private note",data:{...selected.data,widget:{kind:"notes" as const,source:{kind:"workspace" as const,content:"Unrelated private source"}}}}
 return {...emptyParticleGraph(id(1)),revision:1,particles:[selected,privateNote]}
}
export async function seedPageNoteFixture(query:(sql:string)=>Promise<{code:number|null;stderr:string;stdout:string}>){
 const graph=noteFixtureGraph(),named=noteFixtureGraph("Named source"),snapshot={version:1,brand:{name:"Organization",organizationSlug:"organization"},title:"Reviewed page",description:"Reviewed introduction",items:[{id:noteFixtureParticle,title:"Selected note",content:{kind:"notes",markdown:"Shared source"}}]}
 const state={particleGraph:graph,workspaceCatalog:{entries:[{id:noteFixtureCanvas,name:"Named",state:{particleGraph:named}}]},unrelatedField:"keep"}
 const quote=noteFixtureQuote
 const setup=await query(`truncate public.organization_closures cascade;select public.fixture_data_views();
 update public.organization_workspace_boards b set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=b.org_id and id=public.fixture_form_id(20)),b.org_id);
 update public.organization_workspace_boards set state=${quote(state)},updated_by='${id(1)}' where org_id='${id(1)}';
 insert into public.organization_workspace_pages(id,org_id,link_id,title,description,particle_ids,guest_snapshot,published_snapshot,published_at,visibility) values('${noteFixturePage}','${id(1)}','${noteFixturePage}','Reviewed page','Reviewed introduction',array['${noteFixtureParticle}'::uuid],${quote(snapshot)},${quote(snapshot)},clock_timestamp(),'public');
 select public.workspace_page_guest_command('${id(1)}','${noteFixturePage}',${quote({action:"invite",invitationId:id(7010),operationId:id(7011),email:"person2@example.org",permission:"edit"})},repeat('a',64));
 select public.workspace_page_guest_command('${id(2)}','${noteFixturePage}',${quote({action:"accept",invitationId:id(7010)})},null);`)
 if(setup.code!==0)throw new Error(setup.stderr)
 return {graph,named,snapshot,state}
}
