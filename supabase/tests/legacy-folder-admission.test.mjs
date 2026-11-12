// Admission is exercised only in a disposable clone of a local synthetic schema.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const template = new URL(process.env.LEGACY_FOLDER_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_legacy_admission_${process.pid}_${Date.now()}`
const maintenance = new URL(template); maintenance.pathname = '/postgres'
const target = new URL(template); target.pathname = `/${name}`
const env = { ...process.env, PGOPTIONS: '-c statement_timeout=20000 -c timezone=UTC' }
const args = ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', target.href]
const sql = (query, url = target) => {
  const r = spawnSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', url.href], { input: query, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr + r.stdout.slice(-1500))
  return r.stdout.trim()
}
let created = false
try {
  sql(`create database ${name} template ${template.pathname.slice(1)}`, maintenance); created = true
  for (const migration of [
    '20261106010000_project_folder_storage.sql', '20261106020000_private_storage_app_reads.sql',
    '20261106021000_private_storage_cutover_gate.sql', '20261106030000_project_folder_grants.sql',
    '20261106040000_document_file_folder_reads.sql', '20261106050000_document_file_folder_writes.sql',
    '20261106060000_document_file_folder_storage.sql', '20261106070000_document_folder_stage_cleanup.sql',
    '20261106080000_document_folder_purge.sql', '20261111010000_atomic_core_upload_tracking.sql',
    '20261111020000_retain_legacy_document_identities.sql', '20261111030000_legacy_document_cleanup.sql',
    '20261111040000_legacy_cleanup_actor_context.sql', '20261111050000_legacy_document_upload_stages.sql',
    '20261111060000_legacy_stage_closure_compatibility.sql', '20261111070000_legacy_upload_session_commit.sql',
    '20261111080000_legacy_folder_binding_admission.sql',
  ]) sql(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  sql(readFileSync('supabase/tests/legacy-folder-admission.assertions.sql', 'utf8'))
  console.log('[legacy-admission] Canonical identity, cutover, retained sources, rejection and ACL checks passed.')
  const { verifyLegacyAdmissionRaces } = await import('./legacy-folder-admission-races.mjs')
  await verifyLegacyAdmissionRaces({ psql: 'psql', args, env })
  assert.equal(sql('select count(*) from public.document_file_folder_authorities'), '0')
  assert.equal(sql('select count(*) from public.organization_private_storage_cutovers'), '0')
  console.log('[legacy-admission] Synthetic bindings and cutover markers removed; original template untouched.')
} finally {
  if (created) sql(`drop database ${name}`, maintenance)
}
