#!/usr/bin/env node
import { execFileSync, spawnSync, spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
const bin=execFileSync("pg_config",["--bindir"],{encoding:"utf8"}).trim()
const dir=mkdtempSync(join(tmpdir(),"ch-document-retrieval-")),port=String(57000+process.pid%1000)
const run=(name,args,input)=>{const r=spawnSync(join(bin,name),args,{encoding:"utf8",input,env:{...process.env,LC_ALL:"C"}});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout.trim()}
const sql=input=>run("psql",["-h","/tmp","-p",port,"-U","postgres","-d","postgres","-Atq","-v","ON_ERROR_STOP=1"],input)
const file=path=>sql(readFileSync(path,"utf8"))
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`
const actor=(n=1)=>`set role service_role;set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${id(n)}"}';`
const call=(op,payload={},org=1,who=1,canvas=null)=>`select public.workspace_document_retrieval('${id(org)}','${id(who)}',${canvas?`'${id(canvas)}'`:"null"},'${op}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb);`
const invoke=(op,payload={},org=1,who=1,canvas=null)=>JSON.parse(sql(actor(who)+call(op,payload,org,who,canvas)))
let count=0,started=false
const assert=(ok,label)=>{if(!ok)throw Error(label);count++}
const denied=(input,label)=>{let failed=false;try{sql(input)}catch{failed=true}assert(failed,label)}
const fp="a".repeat(64),key=n=>String(n).padStart(64,"0")
const chunk=(n,text,embedding)=>({key:key(n),id:`document:section${n}`,fingerprint:fp,revision:"r1",start:0,end:text.length,text,embedding:JSON.stringify(embedding)})
const chunks=[chunk(1,"The pantry provides groceries to families.",[1,0,0]),chunk(2,"The annual food budget is 4200 dollars.",[0.8,0.2,0]),chunk(3,"Recruit musicians for the concert.",[0,0,1])]
const replace=(expectedRevision,signature,items=chunks)=>({expectedRevision,signature:signature.repeat(64),model:"controlled-v1",dimensions:3,chunks:items})
const query=(mode,revision=1,extra={})=>({revision,model:"controlled-v1",dimensions:3,mode,query:"food",embedding:"[1,0,0]",allowed:chunks.map(c=>({id:c.id,fingerprint:fp})),...extra})
const evidence={kind:"controlled vectors; no paid inference or embeddings",checks:[]}
try{
 run("initdb",["-D",dir,"-A","trust","-U","postgres"])
 run("pg_ctl",["-D",dir,"-o",`-F -k /tmp -p ${port}`,"-l",join(dir,"postgres.log"),"-w","start"]);started=true
 file("supabase/tests/google-drive-rls.bootstrap.sql");file("supabase/tests/workspace-ai.bootstrap.sql")
 const metering=readFileSync("supabase/migrations/20261022120000_workspace_ai_metering.sql","utf8")
 sql(metering.slice(metering.indexOf("create function public.can_use_workspace_ai("),metering.indexOf("create function public.reserve_workspace_ai_run(")))
 sql(`create function auth.role() returns text language sql as 'select current_setting(''request.jwt.claim.role'',true)';
  create table fixture_closure(org_id uuid primary key);create function public.guard_organization_closure(org uuid) returns void language plpgsql as $$begin if exists(select 1 from public.fixture_closure where org_id=org) then raise exception 'Closed';end if;end$$;
  create function public.can_read_workspace_ai(org uuid,actor uuid) returns boolean language sql as 'select public.can_use_workspace_ai(org,actor) and not exists(select 1 from public.fixture_closure where org_id=org)';
  `)
 const baseline=sql("select row_to_json(o)::text from public.organizations o order by user_id;")
 file("supabase/migrations/20261111120000_workspace_document_retrieval.sql")
 file("supabase/migrations/20261111130000_workspace_document_keyword_search.sql")
 assert(invoke("state").revision===0,"empty index")
 assert(invoke("replace",replace(0,"a")).revision===1,"persistent replace")
 const indexedBefore=sql("select row_to_json(i)::text from public.workspace_document_indexes i order by org_id,actor_id,canvas_key;select row_to_json(c)::text from public.workspace_document_chunks c order by org_id,actor_id,canvas_key,chunk_key;")
 file("supabase/migrations/20261111140000_workspace_document_passages.sql")
 assert(sql("select row_to_json(i)::text from public.workspace_document_indexes i order by org_id,actor_id,canvas_key;select row_to_json(c)::text from public.workspace_document_chunks c order by org_id,actor_id,canvas_key,chunk_key;")===indexedBefore,"populated index migration preserves every existing row and vector")
 assert(invoke("replace",replace(0,"a")).revision===1,"idempotent retry")
 const keyword=invoke("search",query("keyword")),semantic=invoke("search",query("semantic")),hybrid=invoke("search",query("hybrid"))
 assert(keyword.length===1&&keyword[0].id===chunks[1].id,"full text keywords")
 assert(semantic[0].id===chunks[0].id&&semantic.length===2,"semantic-only match without keyword")
 assert(hybrid[0].id===chunks[1].id&&hybrid[1].id===chunks[0].id,"reciprocal rank fusion")
 assert(!JSON.stringify(hybrid).includes("groceries")&&!JSON.stringify(hybrid).includes("embedding"),"no indexed body/vector disclosure")
 assert(invoke("search",query("hybrid",1,{allowed:[]})).length===0,"no current candidates")
 assert(invoke("search",query("hybrid",1,{allowed:[{id:chunks[0].id,fingerprint:"b".repeat(64)}]})).length===0,"stale fingerprint excluded")
 const keywordOnly={...replace(0,"a",chunks.map(c=>({...c,embedding:null}))),mode:"keyword"}
 assert(invoke("replace",keywordOnly,1,1,8).revision===1,"keyword index accepts no vectors")
 assert(invoke("state",{model:"controlled-v1",dimensions:3},1,1,8).keys.length===0,"state reports only confirmed reusable vectors")
 assert(invoke("search",query("keyword"),1,1,8)[0].id===chunks[1].id,"keyword search works before any embeddings")
 denied(actor()+call("search",query("hybrid"),1,1,8),"hybrid refuses incomplete vector coverage")
 denied(actor()+call("replace",{...replace(1,"b"),mode:"unapproved"},1,1,8),"unknown indexing mode denied")
 assert(invoke("replace",replace(1,"a"),1,1,8).revision===2,"same-source hybrid fill advances revision")
 assert(invoke("state",{model:"controlled-v1",dimensions:3},1,1,8).keys.length===3,"filled vectors reusable")
 assert(invoke("search",query("hybrid",2),1,1,8).length===2,"hybrid search resumes after admitted vector fill")
 const relocated=chunks.map(c=>({...c,revision:"r2",fingerprint:"b".repeat(64),start:100,end:100+c.text.length,embedding:null}))
 assert(invoke("replace",replace(0,"a"),1,1,10).revision===1,"reuse fixture indexed")
 assert(invoke("replace",{...replace(1,"b",relocated),mode:"keyword"},1,1,10).revision===2,"revision and location refresh")
 assert(invoke("state",{model:"controlled-v1",dimensions:3},1,1,10).keys.length===3,"unchanged content vectors survive moved source passages")
 assert(invoke("search",query("keyword",2),1,1,10).length===0,"old full-source fingerprints remain excluded despite reusable vectors")
 assert(invoke("search",query("keyword",2,{allowed:relocated.map(c=>({id:c.id,fingerprint:c.fingerprint}))}),1,1,10)[0].start===100,"current location returned")
 const repeated=Array.from({length:5},(_,index)=>({...chunks[1],key:key(40+index),start:index*100,end:index*100+chunks[1].text.length}))
 invoke("replace",replace(0,"a",repeated),1,1,11)
 assert(invoke("search",query("keyword",1,{passagesPerSource:3}),1,1,11).length===3,"three distinct passages per source cap")
 assert(invoke("search",query("keyword"),1,1,11).length===1,"older callers retain one passage per source")
 denied(actor()+call("search",query("keyword",1,{passagesPerSource:4}),1,1,11),"larger passage budget refused")
 const refreshed=chunks.map((c,i)=>({...c,...(i===1?{key:key(22),fingerprint:"b".repeat(64),revision:"r2",text:"The revised food budget is 6300 dollars.",end:38}:{}),embedding:null}))
 assert(invoke("replace",{...replace(2,"b",refreshed),mode:"keyword"},1,1,8).revision===3,"keyword edit updates source without embeddings")
 assert(invoke("state",{model:"controlled-v1",dimensions:3},1,1,8).keys.length===2,"keyword update preserves only unchanged vectors")
 const refreshedQuery=query("keyword",3,{allowed:refreshed.map(c=>({id:c.id,fingerprint:c.fingerprint}))})
 assert(invoke("search",refreshedQuery,1,1,8)[0].revision==="r2","keyword result uses current source revision")
 denied(actor()+call("search",{...refreshedQuery,mode:"hybrid"},1,1,8),"changed keyword source cannot reuse stale vectors")
 denied(actor()+call("replace",replace(2,"b",chunks),1,1,8),"stale hydration cannot overwrite newer keyword revision")
 assert(invoke("state",{},1,1,8).revision===3,"failed hydration retains keyword index")
 assert(invoke("state",{},1,2).revision===0,"personal index isolation")
 assert(invoke("state",{},4,4).revision===0,"cross-organization index isolation")
 assert(invoke("state",{},1,1,9).revision===0,"canvas isolation")
 denied(actor(2)+call("search",query("hybrid"),1,1),"actor spoof rejected")
 denied(actor(3)+call("state",{},1,3),"outsider rejected")
 denied("set role authenticated;"+call("state"),"authenticated RPC denied")
 denied("set role anon;"+call("state"),"anonymous RPC denied")
 for(const role of ["anon","authenticated","service_role"]){denied(`set role ${role};select * from public.workspace_document_chunks;`,`${role} direct read denied`);denied(`set role ${role};delete from public.workspace_document_indexes;`,`${role} direct write denied`)}
 denied(actor()+call("replace",replace(0,"b")),"stale writer rejected")
 denied(actor()+call("replace",replace(1,"b",[{...chunks[0],embedding:"[1,0]"}])),"wrong dimensions rejected")
 denied(actor()+call("replace",replace(1,"b",[{...chunks[0],embedding:"[0,0,0]"}])),"zero vector rejected")
 denied(actor()+call("replace",replace(1,"b",[chunks[0],chunks[0]])),"duplicate chunk rollback")
 assert(invoke("state").revision===1&&invoke("search",query("hybrid")).length===2,"failed writes preserve index")
 denied(actor()+call("search",query("hybrid",1,{model:"other"})),"model mismatch rejected")
 denied(actor()+call("search",query("hybrid",1,{embedding:"[1,0]"})),"query dimensions rejected")
 const updated={...chunks[1],fingerprint:"b".repeat(64),revision:"r2",text:"The updated food budget is 6200 dollars."}
 updated.end=updated.text.length
 invoke("replace",replace(1,"b",[updated]))
 assert(invoke("search",query("keyword",2)).length===0,"old revision no longer matches")
 const currentQuery=query("hybrid",2,{allowed:[{id:updated.id,fingerprint:updated.fingerprint}]})
 assert(invoke("search",currentQuery)[0].revision==="r2","updated source matched")
 assert(sql(`select count(*) from public.workspace_document_chunks where org_id='${id(1)}' and actor_id='${id(1)}' and canvas_key='00000000-0000-0000-0000-000000000000';`)==="1","removed source chunks deleted")
 invoke("replace",replace(2,"c",[]));assert(sql(`select count(*) from public.workspace_document_chunks where org_id='${id(1)}' and actor_id='${id(1)}' and canvas_key='00000000-0000-0000-0000-000000000000';`)==="0","clear deletes derived chunks")
 assert(invoke("state",{},1,1,8).revision===3,"clearing one canvas preserves independent keyword index")
 invoke("replace",replace(0,"a"),1,2)
 sql(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(2)}';`)
 denied(actor(2)+call("state",{},1,2),"membership revocation immediate")
 sql(`insert into public.fixture_closure values('${id(1)}');`)
 denied(actor()+call("search",query("hybrid",3)),"closed organization denied")
 assert(sql("select row_to_json(o)::text from public.organizations o order by user_id;")===baseline,"canonical organizations preserved")
 assert(sql("select count(*) from pg_class where relname in ('workspace_document_indexes','workspace_document_chunks') and relrowsecurity and relforcerowsecurity;")==="2","forced RLS")
 const concurrent=input=>new Promise(resolve=>{const child=spawn(join(bin,"psql"),["-h","/tmp","-p",port,"-U","postgres","-d","postgres","-Atq","-v","ON_ERROR_STOP=1"],{stdio:["pipe","ignore","ignore"]});child.on("exit",code=>resolve(code));child.stdin.end(input)})
 const statuses=await Promise.all([concurrent(actor(4)+"begin;"+call("replace",replace(0,"d"),4,4)+"select pg_sleep(0.1);commit;"),concurrent(actor(4)+call("replace",replace(0,"e"),4,4))])
 assert(statuses.filter(code=>code===0).length===1,"concurrent CAS one winner")
 assert(invoke("state",{},4,4).revision===1,"concurrent scope revision preserved")
 evidence.checks.push({keyword:keyword.map(x=>x.id),semantic:semantic.map(x=>x.id),hybrid:hybrid.map(x=>x.id)})
 // The same real database backs the existing tool/answer integration tests.
 if(process.env.RETRIEVAL_INTEGRATION==="1"){
  sql(`delete from public.fixture_closure;`)
  const r=spawnSync("pnpm",["exec","vitest","run","--config","vitest.config.ts","tests/acceptance/workspace-document-retrieval.test.ts"],{encoding:"utf8",env:{...process.env,RETRIEVAL_PG_PORT:port,RETRIEVAL_PG_BIN:bin},timeout:120000})
  process.stdout.write(r.stdout??"");process.stderr.write(r.stderr??"");if(r.status!==0)throw Error("Document tool integration failed")
 }
 console.log(JSON.stringify({assertions:count,pgvector:sql("select extversion from pg_extension where extname='vector'"),...evidence}))
 if(process.env.RETRIEVAL_RECEIPT)writeFileSync(process.env.RETRIEVAL_RECEIPT,JSON.stringify({assertions:count,...evidence},null,2))
}finally{if(started)run("pg_ctl",["-D",dir,"-m","immediate","-w","stop"]);rmSync(dir,{recursive:true,force:true})}
