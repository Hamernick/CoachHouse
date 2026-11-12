// Only a new disposable clone of the existing synthetic full-schema fixture.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.LEGACY_UPLOAD_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name=`ch_legacy_stage_${process.pid}_${Date.now()}`
const maintenance=new URL(template);maintenance.pathname='/postgres'
const target=new URL(template);target.pathname=`/${name}`
const env={...process.env,PGOPTIONS:'-c statement_timeout=20000 -c timezone=UTC'}
const args=['-XqAt','-v','ON_ERROR_STOP=1','-d',target.href]
const sql=(query,url=target)=>{const r=spawnSync('psql',['-XqAt','-v','ON_ERROR_STOP=1','-d',url.href],{input:query,env,encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
let created=false
try {
 sql(`create database ${name} template ${template.pathname.slice(1)}`,maintenance);created=true
 for(const migration of ['20261106010000_project_folder_storage.sql','20261106030000_project_folder_grants.sql','20261106040000_document_file_folder_reads.sql','20261106050000_document_file_folder_writes.sql','20261106060000_document_file_folder_storage.sql','20261106070000_document_folder_stage_cleanup.sql','20261106080000_document_folder_purge.sql','20261111010000_atomic_core_upload_tracking.sql','20261111020000_retain_legacy_document_identities.sql','20261111030000_legacy_document_cleanup.sql','20261111040000_legacy_cleanup_actor_context.sql','20261111050000_legacy_document_upload_stages.sql','20261111060000_legacy_stage_closure_compatibility.sql','20261111070000_legacy_upload_session_commit.sql']) {
  sql(readFileSync(`supabase/migrations/${migration}`,'utf8'))
 }
 sql(readFileSync('supabase/tests/legacy-upload-stages.assertions.sql','utf8'))
 console.log('[legacy-upload] Full-schema stage, folder authority, quota transfer, abandonment, deletion, replay and ACL checks passed.')
 const {verifyLegacyUploadRaces}=await import('./legacy-upload-stages-races.mjs')
 await verifyLegacyUploadRaces({psql:'psql',args,env})
} finally {if(created)sql(`drop database ${name}`,maintenance)}
