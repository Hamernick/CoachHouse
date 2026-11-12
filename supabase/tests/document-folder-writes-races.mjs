import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

export async function verifyDocumentFolderWriteConcurrency({ postgresDirectory, port, socketDirectory, storage = false }) {
  const sql = (query, onLocked) => new Promise((resolve, reject) => {
    const child = spawn(join(postgresDirectory, 'psql'), ['-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'])
    let output='',error='',notified=false
    child.stdout.on('data',data=>{output+=data;if(!notified&&output.includes('locked')){notified=true;onLocked?.()}})
    child.stderr.on('data',data=>{error+=data})
    child.on('error',reject)
    child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error)))
    child.stdin.end(query)
  })
  const owner='00000000-0000-4000-8000-000000000701',actor='00000000-0000-4000-8000-000000000704'
  const project='00000000-0000-4000-8000-000000000801',folder='00000000-0000-4000-8000-000000000811',file='00000000-0000-4000-8000-000000000901'
  const access=(grants)=>`select set_project_asset_folder_access('${project}','${folder}','${owner}',(select access_revision from project_asset_folders where project_id='${project}' and id='${folder}'),'restricted','${JSON.stringify(grants)}');`
  const grant=()=>sql(access([{memberId:actor,capability:'edit'}]))
  const mutation=storage ? `update storage.objects set metadata='{"size":3}' where name like '%00000000-0000-4000-8000-000000000941.md';` : `update organization_document_files set name='Race.md' where id='${file}';`
  const edit=`set role service_role;set request.headers='{"x-coach-house-actor-id":"${actor}"}';${mutation}`
  const race=async(first,second)=>{
    let acquired
    const locked=new Promise(resolve=>{acquired=resolve})
    const a=sql(`begin;${first}select 'locked';select pg_sleep(0.2);commit;`,acquired)
    await Promise.race([locked,a.then(()=>{throw new Error('Lock marker missing')})])
    return Promise.allSettled([a,sql(second)])
  }
  await grant()
  let result=await race(access([]),edit)
  assert.equal(result[0].status,'fulfilled')
  assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/permission is changing/)
  await assert.rejects(sql(edit),/editing access required/)
  await grant()
  result=await race(edit,access([]))
  assert.ok(result.every(item=>item.status==='fulfilled'))
  assert.equal(await sql(`select count(*) from project_asset_folder_grants where member_id='${actor}';`),'0')
  await assert.rejects(sql(edit),/editing access required/)
  await grant()
  result=await race(`delete from organization_memberships where org_id='${owner}' and member_id='${actor}';`,edit)
  assert.equal(result[0].status,'fulfilled')
  assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/permission is changing/)
  await assert.rejects(sql(edit),/editing access required/)
  await sql(`insert into organization_memberships(org_id,member_id,role) values('${owner}','${actor}','admin');`)
  await assert.rejects(sql(edit),/editing access required/)
  await grant()
  result=await race(edit,`delete from organization_memberships where org_id='${owner}' and member_id='${actor}';`)
  assert.ok(result.every(item=>item.status==='fulfilled'))
  await assert.rejects(sql(edit),/editing access required/)
  console.log(`[document-folder-${storage ? 'storage' : 'writes'}] Both orderings of grant and membership revocation serialized with actual ${storage ? 'Storage' : 'file'} writes; rejoin did not restore access.`)
}
