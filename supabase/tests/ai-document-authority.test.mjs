import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { verifyAiDocumentAuthorityRaces } from './ai-document-authority-races.mjs'
const template = new URL(process.env.AI_DOCUMENT_AUTHORITY_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_ai_document_${process.pid}_${Date.now()}`
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
  for (const migration of ['20261105150000_workspace_research_conversations.sql','20261105180000_workspace_chat_controls.sql','20261105200000_workspace_chat_plan_revisions.sql','20261105210000_workspace_chat_messages.sql','20261105220000_workspace_chat_replies.sql','20261106100000_workspace_particle_ai_origins.sql','20261106110000_workspace_particle_ai_transitive_origins.sql','20261106120000_workspace_particle_ai_context_origins.sql']) sql(readFileSync(`supabase/migrations/${migration}`, 'utf8'))
  sql(readFileSync('supabase/migrations/20261106130000_workspace_particle_origin_readers.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261106210000_ai_document_commit_authority.sql','utf8'))
  sql(readFileSync('supabase/tests/ai-document-authority-fixture.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107000000_workspace_ai_document_origins.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107010000_workspace_ai_document_source_reader.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107020000_workspace_ai_document_save_sources.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107030000_workspace_ai_document_copy_sources.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261107040000_workspace_ai_document_copy_readers.sql','utf8'))
  sql(readFileSync('supabase/tests/ai-document-copy-sources.assertions.sql','utf8'))
  sql(readFileSync('supabase/tests/ai-document-save-sources.assertions.sql','utf8'))
  sql(readFileSync('supabase/tests/ai-document-origins.assertions.sql','utf8'))
  sql(readFileSync('supabase/tests/ai-document-authority.assertions.sql','utf8'))
  await verifyAiDocumentAuthorityRaces(target, env)
  console.log('[ai-document] Verified identity, ACLs, owner/editor access, CAS, replay and isolation passed.')
} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
