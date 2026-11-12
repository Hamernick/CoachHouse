// Explicit, local, synthetic full-schema template only. The source is read-only;
// all mutations run in a fresh disposable copy, including real existing guards.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const template = new URL(process.env.DOCUMENT_FOLDER_DISCLOSURES_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_folder_disclosures_${process.pid}_${Date.now()}`
const maintenance = new URL(template); maintenance.pathname = '/postgres'
const target = new URL(template); target.pathname = `/${name}`
const env = { ...process.env, PGOPTIONS: '-c statement_timeout=15000 -c timezone=UTC' }
const sql = (query, url = target) => {
  const r = spawnSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-d', url.href], { input: query, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim()
}
let created = false
try {
  sql(`create database ${name} template ${template.pathname.slice(1)};`, maintenance); created = true
  for (const migration of [
    '20261106010000_project_folder_storage.sql', '20261106030000_project_folder_grants.sql',
    '20261106040000_document_file_folder_reads.sql', '20261106050000_document_file_folder_writes.sql',
    '20261106060000_document_file_folder_storage.sql', '20261106070000_document_folder_stage_cleanup.sql', '20261106080000_document_folder_purge.sql', '20261106090000_document_folder_disclosures.sql',
  ]) sql(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  sql('begin;'+readFileSync('supabase/tests/document-folder-stage-cleanup.assertions.sql', 'utf8').replaceAll('ch_stage_cleanup_%','ch_folder_disclosures_%')+'\nrollback;')
  sql(readFileSync('supabase/tests/document-folder-purge.assertions.sql', 'utf8').replaceAll('ch_folder_purge_%','ch_folder_disclosures_%'))
  sql(readFileSync('supabase/tests/document-folder-disclosures.assertions.sql','utf8'))
  console.log('[folder-disclosures] Prior stage/purge regressions and real activity RLS, elevated filtering, revocation, purge, rejoin and retired-folder assertions passed.')

} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
