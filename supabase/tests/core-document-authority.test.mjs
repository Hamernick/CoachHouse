import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { verifyCoreDocumentAuthorityRaces } from './core-document-authority-races.mjs'
const template = new URL(process.env.CORE_DOCUMENT_AUTHORITY_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_core_document_${process.pid}_${Date.now()}`
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
  sql(readFileSync('supabase/migrations/20261106220000_core_document_commit_authority.sql','utf8'))
  sql(readFileSync('supabase/tests/core-document-authority-fixture.sql','utf8'))
  sql(readFileSync('supabase/tests/core-document-authority.assertions.sql','utf8'))
  await verifyCoreDocumentAuthorityRaces(target, env)
  console.log('[core-document] Verified identity, editor/support authority, atomic session/profile CAS and isolation passed.')
} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
