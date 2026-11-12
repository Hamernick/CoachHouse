import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { verifyRoadmapProfileAuthorityRaces } from './roadmap-profile-authority-races.mjs'
const template = new URL(process.env.ROADMAP_PROFILE_TEST_DATABASE_URL || 'file:///missing')
assert.equal(template.hostname, '127.0.0.1', 'Explicit local full-schema fixture required')
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, '')
assert.equal(template.search, '')
const name = `ch_roadmap_profile_${process.pid}_${Date.now()}`
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
  sql(readFileSync('supabase/migrations/20261106234000_roadmap_profile_commit.sql','utf8'))
  sql(readFileSync('supabase/migrations/20261106235100_roadmap_publication_commit.sql','utf8'))
  sql(readFileSync('supabase/tests/roadmap-profile-authority-fixture.sql','utf8'))
  sql(readFileSync('supabase/tests/roadmap-profile-authority.assertions.sql','utf8'))
  sql(readFileSync('supabase/tests/roadmap-publication.assertions.sql','utf8'))
  await verifyRoadmapProfileAuthorityRaces(target, env)
  await verifyRoadmapProfileAuthorityRaces(target, env, true)
  console.log('[roadmap-profile] Verified identity, current authority, profile CAS, rollback, Free Drive allowance and isolation passed.')
} finally {
  if (created) sql(`drop database ${name};`, maintenance)
}
