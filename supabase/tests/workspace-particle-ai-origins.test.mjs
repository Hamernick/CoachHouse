// Explicit, local, synthetic full-schema template only. The source is read-only;
// all mutations run in a fresh disposable copy, including real existing guards.
import assert from 'node:assert/strict'
import { verifyFinanceReportSourceRaces } from './finance-report-source-races.mjs'
import { verifyWorkspaceBoardEditorRaces } from './workspace-board-editor-races.mjs'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { verifyResourceMatchSourceRaces } from './resource-match-source-races.mjs'
import { verifyWorkspacePageSourceRaces } from './workspace-page-source-races.mjs'
import { verifyWorkspaceCatalogRaces } from './workspace-catalog-source-races.mjs'
import { verifyParticleSourceWriteRaces } from './workspace-particle-source-write-races.mjs'
const template = new URL(process.env.PARTICLE_AI_ORIGINS_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_particle_origins_${process.pid}_${Date.now()}`
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
  sql(readFileSync('supabase/tests/workspace-particle-ai-origins.assertions.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-particle-ai-transitive-origins.assertions.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261106140000_workspace_particle_source_write_fence.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-particle-source-write.assertions.sql','utf8'))
  await verifyParticleSourceWriteRaces(target, env)
  sql(readFileSync('supabase/migrations/20261106150000_workspace_particle_source_reads.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-particle-source-read.assertions.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261106160000_workspace_catalog_source_permissions.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-catalog-source.assertions.sql','utf8'))
  await verifyWorkspaceCatalogRaces(target, env)
  sql(readFileSync('supabase/migrations/20261106170000_workspace_page_source_permissions.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-page-source.assertions.sql','utf8'))
  await verifyWorkspacePageSourceRaces(target, env)
  sql(readFileSync('supabase/migrations/20261106180000_resource_match_source_permissions.sql','utf8'))
  sql(readFileSync('supabase/tests/resource-match-source.assertions.sql','utf8'))
  await verifyResourceMatchSourceRaces(target, env)
  sql(readFileSync('supabase/migrations/20261106190000_workspace_board_editor_commit.sql','utf8'))
  sql(readFileSync('supabase/tests/workspace-board-editor.assertions.sql','utf8'))
  await verifyWorkspaceBoardEditorRaces(target, env)
  sql(readFileSync('supabase/tests/finance-report-source-before.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261106200000_finance_report_source_permissions.sql','utf8'))
  sql(readFileSync('supabase/tests/finance-report-source.assertions.sql','utf8'))
  await verifyFinanceReportSourceRaces(target, env)
  console.log('[particle-origins] Real board trigger, immutable receipt lineage, chat deletion, scope and service authorization checks passed.')

} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
