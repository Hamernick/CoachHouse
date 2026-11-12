import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
export async function verifyLegacyUploadRaces({psql,args,env}) {
 const org='e972bc07-fbf5-4fc8-a416-7f00910a71e2'
 const actor='90b6c688-889c-467f-9edd-166f28bf0819'
 const project='79000000-0000-4000-8000-000000000001'
 const context=`set request.jwt.claim.role='service_role';set request.headers='{"x-coach-house-actor-id":"${org}"}';set storage.allow_delete_query='true';`
 const path=n=>`${org}/w9/79000000-0000-4000-8000-${String(n).padStart(12,'0')}-race.pdf`
 const sql=query=>{const r=spawnSync(psql,args,{input:context+query,env,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const reserve=n=>`select reserve_legacy_document_upload('${org}','w9','${path(n)}',10,'${org}');`
 const upload=n=>`insert into storage.objects(bucket_id,name,metadata) values('org-documents','${path(n)}','{"size":10}');`
 const commit=n=>`update organizations set profile=jsonb_set(profile,'{documents,w9}',jsonb_build_object('path','${path(n)}','name','race.pdf','size',10)) where user_id='${org}';`
 const abandon=n=>`select abandon_legacy_document_upload('${org}','${path(n)}','${org}');select reserve_legacy_document_stage_cleanup('${org}','${org}',false,'${path(n)}');`
 const finish=n=>`select finish_legacy_document_stage_cleanup('${org}','${path(n)}','${org}');`
 const session=(query,notify)=>new Promise((resolve,reject)=>{const child=spawn(psql,args,{env});let output='',error='',notified=false;child.stdout.on('data',b=>{output+=b;if(!notified&&output.includes('locked')){notified=true;notify?.()}});child.stderr.on('data',b=>{error+=b});child.on('error',reject);child.on('close',code=>resolve({code,output,error}));child.stdin.end(context+query)})
 const race=async(first,second)=>{let notify;const locked=new Promise(r=>{notify=r});const a=session(`begin;${first}select 'locked';select pg_sleep(0.2);commit;`,notify);await Promise.race([locked,a.then(r=>{throw Error(`No lock marker ${r.error}`)})]);const b=await session(second);const done=await a;assert.equal(done.code,0,done.error);return b}
 sql(reserve(101))
 let r=await race(abandon(101)+finish(101),upload(101));assert.notEqual(r.code,0);assert.match(r.error,/retry|available/)
 assert.equal(sql(`select state from legacy_document_upload_stages where storage_path='${path(101)}';`),'cleaned')
 assert.equal(sql(`select count(*) from storage.objects where name='${path(101)}';`),'0')
 sql(reserve(102))
 r=await race(upload(102),abandon(102));assert.equal(r.code,0,r.error)
 assert.equal(sql(finish(102)),'f')
 sql(`delete from storage.objects where name='${path(102)}';`+finish(102))
 sql(reserve(103)+upload(103))
 r=await race(commit(103),abandon(103));assert.notEqual(r.code,0);assert.match(r.error,/retry|changing/)
 assert.equal(sql(`select abandon_legacy_document_upload('${org}','${path(103)}','${org}');`),'committed')
 assert.equal(sql(`select count(*) from storage.objects where name='${path(103)}';`),'1')
 sql(reserve(104)+upload(104))
 r=await race(abandon(104),commit(104));assert.notEqual(r.code,0);assert.match(r.error,/available/)
 assert.equal(sql(`select storage_path from organization_document_files where org_id='${org}' and document_kind='w9';`),path(103))
 // Current grants, not the stage's historic editor, govern retry cleanup.
 const actorContext=`set request.headers='{"x-coach-house-actor-id":"${actor}"}';`
 sql(`select reserve_legacy_document_upload('${org}','w9','${path(105)}',10,'${org}');`+upload(105)+abandon(105))
 sql(actorContext+`select reserve_legacy_document_stage_cleanup('${org}','${actor}',false,'${path(105)}');`)
 r=await race(`update project_asset_folder_grants set capability='view' where project_id='${project}';`,actorContext+`delete from storage.objects where name='${path(105)}';`)
 assert.notEqual(r.code,0);assert.match(r.error,/changing|access required/)
 assert.equal(sql(`select count(*) from storage.objects where name='${path(105)}';`),'1')
 console.log('[legacy-upload] Claim/late-upload, upload/claim, commit/abandon, abandon/commit and revocation/delete races passed.')
}
