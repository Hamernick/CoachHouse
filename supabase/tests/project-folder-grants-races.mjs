import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

export async function verifyFolderGrantConcurrency({ postgresDirectory, port, socketDirectory }) {
  const sql = (query, onLocked) => new Promise((resolve, reject) => {
    const child = spawn(join(postgresDirectory, 'psql'), ['-h',socketDirectory,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'])
    let output='',error='',notified=false
    child.stdout.on('data',data=>{output+=data;if(!notified&&output.includes('locked')){notified=true;onLocked?.()}})
    child.stderr.on('data',data=>{error+=data})
    child.on('error',reject)
    child.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error)))
    child.stdin.end(query)
  })
  const owner='00000000-0000-4000-8000-000000000701',project='00000000-0000-4000-8000-000000000803',folder='00000000-0000-4000-8000-000000000831'
  await sql(`insert into organization_projects(id,org_id,name,created_by,updated_by) values('${project}','${owner}','Folder grant race','${owner}','${owner}');
    select mutate_project_asset_folder(id,org_id,org_id,updated_at,'{"type":"create","name":"Race"}','${folder}') from organization_projects where id='${project}';`)
  const access=(revision,audience)=>`select set_project_asset_folder_access('${project}','${folder}','${owner}',${revision},'${audience}','[]');`
  const race=async(first,second)=>{
    let acquired
    const locked=new Promise(resolve=>{acquired=resolve})
    const a=sql(`begin;${first}select 'locked';select pg_sleep(0.15);commit;`,acquired)
    await Promise.race([locked,a.then(()=>{throw new Error('Lock marker missing')})])
    return Promise.allSettled([a,sql(second)])
  }
  let result=await race(access(0,'restricted'),access(0,'inherited'))
  assert.equal(result[0].status,'fulfilled')
  assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Folder access changed/)
  assert.equal(await sql(`select audience||':'||access_revision from project_asset_folders where project_id='${project}';`),'restricted:1')
  // An incoming file serializes with restriction and leaves either a shared file
  // or an empty restricted folder, never a hidden folder with exposed contents.
  const blocked=await sql(`insert into project_asset_folder_placements(project_id,file_key,folder_id) values('${project}','organization:blocked','${folder}');`).then(()=>false,()=>true)
  assert.equal(blocked,true)
  await sql(access(1,'inherited'))
  result=await race(`insert into project_asset_folder_placements(project_id,file_key,folder_id) values('${project}','organization:race','${folder}');`,access(2,'restricted'))
  assert.equal(result[0].status,'fulfilled')
  assert.equal(result[1].status,'rejected')
  assert.match(result[1].reason.message,/Source permissions must be connected/)
  assert.equal(await sql(`select audience||':'||access_revision from project_asset_folders where project_id='${project}';`),'inherited:2')
  assert.equal(await sql(`select count(*) from project_asset_folder_placements where project_id='${project}';`),'1')
  await sql(`delete from organization_projects where id='${project}';`)
  console.log('[project-folder-grants] Two-session stale grant and incoming-file races preserved authority and contents.')
}
