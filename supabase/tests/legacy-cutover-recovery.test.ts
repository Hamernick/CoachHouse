// Isolated PostgreSQL + real filesystem bytes. Storage HTTP/CDN is not simulated
// as qualified: prior staging cache failures remain a separate activation gate.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, writeFileSync, existsSync, unlinkSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeAll, afterAll, expect, it, vi } from "vitest"
const transport = vi.hoisted(() => ({ admin: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: transport.admin }))
import { captureLegacyCutoverRecovery, readLegacyCutoverSource, replaceLegacyDocumentFromRecovery } from "../../src/lib/organization/legacy-document-cutover"
import { uploadLegacyDocumentStage } from "../../src/lib/organization/legacy-document-upload-stage"
import { reconcileLegacyDocumentCleanup } from "../../src/lib/organization/legacy-document-cleanup"
import { mutateOrganizationProfile } from "../../src/lib/organization/profile-mutation"

const template = new URL(process.env.LEGACY_CUTOVER_TEST_DATABASE_URL || "file:///missing")
assert.equal(template.hostname, "127.0.0.1")
assert.match(template.pathname, /^\/workspace_sharing_fixture_[a-z0-9_]+$/)
assert.equal(template.password, ""); assert.equal(template.search, "")
const name = `ch_legacy_cutover_${process.pid}_${Date.now()}`
const target = new URL(template); target.pathname = `/${name}`
const maintenance = new URL(template); maintenance.pathname = "/postgres"
const directory = mkdtempSync(join(tmpdir(), "ch-legacy-cutover-"))
const orgId = "e972bc07-fbf5-4fc8-a416-7f00910a71e2"
const memberId = "90b6c688-889c-467f-9edd-166f28bf0819"
const literal = (value: unknown): string => value === null ? "null" : Array.isArray(value)
  ? `array[${value.map(literal).join(",")}]::uuid[]`
  : typeof value === "boolean" || typeof value === "number" ? String(value)
    : `'${String(value).replaceAll("'", "''")}'`
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`
function sql(query: string, url = target) {
  const result = spawnSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", "-d", url.href], {
    input: query, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PGOPTIONS: "-c statement_timeout=20000 -c timezone=UTC" },
  })
  if (result.status !== 0) throw Error(result.stderr)
  return result.stdout.trim()
}
const context = (actor: string, role: string) => `begin;set local role ${role};
 set local request.jwt.claim.role=${literal(role)};set local request.jwt.claim.sub=${literal(actor)};
 set local request.jwt.claims=${literal(JSON.stringify({ role, sub: actor }))};
 set local request.headers=${literal(JSON.stringify({ "x-coach-house-actor-id": actor }))};
 set local storage.allow_delete_query='true';`
const run = (query: string, actor: string, role: string) => sql(`${context(actor, role)}${query};commit;`)
const bytesPath = (path: string) => join(directory, createHash("sha256").update(path).digest("hex"))
function client(actor: string, role: string): any {
  return {
    auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) },
    from: (table: string) => {
      assert.ok(["organizations", "organization_document_files"].includes(table))
      let columns = "*", update: any, predicates: string[] = []
      const execute = async (single = false) => {
        try {
          const statement = update ? `update public.${table} set profile=${json(update.profile)} where ${predicates.join(" and ")} returning ${columns}`
            : `select ${columns} from public.${table} where ${predicates.join(" and ") || "true"}`
          const rows = JSON.parse(run(`with q as (${statement}) select coalesce(jsonb_agg(to_jsonb(q)),'[]') from q`, actor, role))
          return { data: single ? rows[0] ?? null : rows, error: null }
        } catch (error) { return { data: null, error: { message: String(error) } } }
      }
      const query: any = {
        select: (value: string) => { assert.match(value, /^[a-z_,* ]+$/); columns = value; return query },
        eq: (key: string, value: unknown) => { assert.match(key, /^[a-z_]+$/); predicates.push(`${key}=${literal(value)}`); return query },
        in: (key: string, values: string[]) => { assert.match(key, /^[a-z_]+$/); predicates.push(`${key} in (${values.map(literal).join(",")})`); return query },
        update: (value: unknown) => { update = value; return query },
        abortSignal: () => query,
        single: () => execute(true), maybeSingle: () => execute(true),
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      }
      return query
    },
    rpc: async (method: string, args: Record<string, unknown>) => {
      assert.match(method, /^[a-z_]+$/)
      try {
        const call = Object.entries(args).map(([key, value]) => { assert.match(key, /^[a-z_]+$/); return `${key}=>${literal(value)}` }).join(",")
        return { data: JSON.parse(run(`select to_jsonb(public.${method}(${call}))`, actor, role)), error: null }
      } catch (error) { return { data: null, error: { message: String(error) } } }
    },
    storage: { from: (bucket: string) => {
      assert.equal(bucket, "org-documents")
      return {
        upload: async (path: string, bytes: Buffer) => {
          try {
            run(`insert into storage.objects(bucket_id,name,metadata) values('org-documents',${literal(path)},${json({ size: bytes.length })})`, actor, role)
            writeFileSync(bytesPath(path), bytes, { flag: "wx", mode: 0o600 })
            return { error: null }
          } catch (error) { return { error: { message: String(error) } } }
        },
        download: async (path: string) => {
          const present = run(`select count(*) from storage.objects where bucket_id='org-documents' and name=${literal(path)}`, actor, role)
          return present === "1" && existsSync(bytesPath(path))
            ? { data: new Blob([readFileSync(bytesPath(path))]), error: null }
            : { data: null, error: { message: "Absent fixture bytes" } }
        },
        remove: async (paths: string[]) => {
          try {
            for (const path of paths) {
              run(`delete from storage.objects where bucket_id='org-documents' and name=${literal(path)}`, actor, role)
              if (existsSync(bytesPath(path))) unlinkSync(bytesPath(path))
            }
            return { error: null }
          } catch (error) { return { error: { message: String(error) } } }
        },
      }
    } },
  }
}
let created = false
beforeAll(() => {
  sql(`create database ${name} template ${template.pathname.slice(1)}`, maintenance); created = true
  // Reuse the qualified predecessor chain, without applying admission80000.
  const predecessor = readFileSync("supabase/tests/legacy-folder-admission.test.mjs", "utf8")
  for (const match of predecessor.matchAll(/'(2026\d+_[a-z_]+\.sql)'/g))
    if (!match[1].startsWith("20261111080000")) sql(readFileSync(`supabase/migrations/${match[1]}`, "utf8"))
  transport.admin.mockImplementation(({ actorId }: { actorId: string }) => client(actorId, "service_role"))
}, 30000)
afterAll(() => {
  try { if (created) sql(`drop database ${name}`, maintenance) }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

it("preserves identity/history/copies/access, verifies disk recovery, and never enables the cutover", async () => {
  const session = client(orgId, "authenticated")
  const scope = { supabase: session, orgId, documentKind: "w9" }
  const original = Buffer.from("controlled cutover bytes; retain exactly\n")
  const oldPath = `${orgId}/w9/94c00000-0000-4000-8000-000000000001-original.pdf`
  await uploadLegacyDocumentStage({ orgId, documentKind: "w9", actorId: orgId, path: oldPath }, original, "application/pdf")
  const document = { path: oldPath, size: original.length, name: "Recovery fixture", mime: "application/pdf", updatedAt: "2026-11-11T00:00:00Z", preservedField: { value: 7 } }
  const seeded = await mutateOrganizationProfile({ supabase: session, orgId, mutate: profile => {
    assert.ok(!(profile.documents as any)?.w9)
    return { changed: true, nextProfile: { ...profile, documents: { ...(profile.documents as object), w9: document } }, value: null }
  } })
  assert.ok("ok" in seeded, JSON.stringify(seeded))
  const captured = await captureLegacyCutoverRecovery(scope)
  writeFileSync(join(directory, "recovery.json"), JSON.stringify({ ...captured, bytes: undefined }), { flag: "wx", mode: 0o600 })
  writeFileSync(join(directory, "recovery.bytes"), captured.bytes, { flag: "wx", mode: 0o600 })
  const readRecovery = async () => ({ ...JSON.parse(readFileSync(join(directory, "recovery.json"), "utf8")), bytes: readFileSync(join(directory, "recovery.bytes")) })
  expect((await readRecovery()).bytes).toEqual(original)
  // Retained original remains referenced; preparation must not retire it as waste.
  sql(`set request.jwt.claim.role='service_role';set request.headers=${literal(JSON.stringify({ "x-coach-house-actor-id": orgId }))};
    insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state,source_storage_path,source_size_bytes)
    values(${literal(captured.source.fileId)},'94c00000-0000-4000-8000-000000000002',${literal(orgId)},${literal(orgId)},'cutover-retained',${original.length},'committed',${literal(oldPath)},${original.length});`)
  const retainedBefore = sql(`select to_jsonb(o) from document_version_operations o where request_id='94c00000-0000-4000-8000-000000000002'`)
  const versionPath = `${orgId}/library/versions/${captured.source.fileId}/94c00000-0000-4000-8000-000000000003-previous.md`
  const versionBytes = Buffer.from("retained historical version")
  const unknownPath = `${orgId}/historical/unknown-lineage.pdf`
  const unknownBytes = Buffer.from("unknown lineage must survive")
  const storage = client(orgId, "service_role").storage.from("org-documents")
  sql(`set request.jwt.claim.role='service_role';set request.headers=${literal(JSON.stringify({ "x-coach-house-actor-id": orgId }))};
    insert into document_version_operations(file_id,request_id,org_id,actor_id,fingerprint,staged_bytes,state)
    values(${literal(captured.source.fileId)},'94c00000-0000-4000-8000-000000000003',${literal(orgId)},${literal(orgId)},'cutover-history-stage',${versionBytes.length},'staged')`)
  expect((await storage.upload(versionPath, versionBytes)).error).toBeNull()
  expect((await storage.upload(unknownPath, unknownBytes)).error).toBeNull()
  sql(`set request.jwt.claim.role='service_role';set request.headers=${literal(JSON.stringify({ "x-coach-house-actor-id": orgId }))};
    insert into document_file_versions(file_id,org_id,actor_id,storage_path,name,mime_type,size_bytes,content_hash,revision,source_updated_at,generation,sequence)
    values(${literal(captured.source.fileId)},${literal(orgId)},${literal(orgId)},${literal(versionPath)},'History','text/markdown',${versionBytes.length},
    ${literal(createHash("sha256").update(versionBytes).digest("hex"))},'cutover-history',now(),'94c00000-0000-4000-8000-000000000004',0)`)
  sql(`update document_version_operations set state='committed',source_storage_path=${literal(oldPath)},source_size_bytes=${original.length}
    where request_id='94c00000-0000-4000-8000-000000000003'`)
  const existingTables = ["document_file_versions", "organization_workspace_pages", "workspace_page_document_grants", "workspace_page_image_grants", "workspace_page_invitations", "workspace_page_guest_receipts"]
  const snapshots = () => Object.fromEntries(existingTables.map(table => [table, sql(`select md5(coalesce(string_agg(t::text,'' order by t::text),'')) from ${table} t`)]))
  const copiesBefore = snapshots()
  const prepared = await replaceLegacyDocumentFromRecovery({ supabase: session, expected: captured.source, readRecovery })
  expect(prepared.activationAllowed).toBe(false)
  expect(prepared.current.fileId).toBe(captured.source.fileId)
  expect(readFileSync(bytesPath(prepared.current.document.path))).toEqual(original)
  await reconcileLegacyDocumentCleanup({ orgId, documentKind: "w9", actorId: orgId })
  expect(readFileSync(bytesPath(oldPath))).toEqual(original)
  expect(sql(`select completed_at is null from legacy_document_cleanup where storage_path=${literal(oldPath)}`)).toBe("t")
  // Inject byte loss on the owned fixture only. Recovery must use the disk copy,
  // keep source identity, and choose a third path rather than reviving old links.
  unlinkSync(bytesPath(prepared.current.document.path))
  const recovered = await replaceLegacyDocumentFromRecovery({ supabase: session, expected: prepared.current, readRecovery })
  expect(recovered.current.fileId).toBe(captured.source.fileId)
  expect(readFileSync(bytesPath(recovered.current.document.path))).toEqual(original)
  expect(recovered.current.document.path).not.toBe(oldPath)
  expect(recovered.current.document.path).not.toBe(prepared.current.document.path)
  await reconcileLegacyDocumentCleanup({ orgId, documentKind: "w9", actorId: orgId })
  expect(sql(`select completed_at is not null and size_bytes=0 from legacy_document_cleanup where storage_path=${literal(prepared.current.document.path)}`)).toBe("t")
  expect(sql(`select to_jsonb(o) from document_version_operations o where request_id='94c00000-0000-4000-8000-000000000002'`)).toBe(retainedBefore)
  expect(snapshots()).toEqual(copiesBefore)
  expect(readFileSync(bytesPath(versionPath))).toEqual(versionBytes)
  expect(readFileSync(bytesPath(unknownPath))).toEqual(unknownBytes)
  // Current source authority is real SQL/RLS; the auth transport is fixture-only.
  sql(`insert into organization_memberships(org_id,member_id,role,member_email) select ${literal(orgId)},${literal(memberId)},'staff',email from auth.users where id=${literal(memberId)} on conflict(org_id,member_id) do update set role='staff'`)
  expect((await readLegacyCutoverSource({ ...scope, supabase: client(memberId, "authenticated") })).fileId).toBe(captured.source.fileId)
  const membership = sql(`select to_jsonb(m) from organization_memberships m where org_id=${literal(orgId)} and member_id=${literal(memberId)}`)
  sql(`delete from organization_memberships where org_id=${literal(orgId)} and member_id=${literal(memberId)}`)
  await expect(readLegacyCutoverSource({ ...scope, supabase: client(memberId, "authenticated") })).rejects.toThrow()
  sql(`insert into organization_memberships select * from jsonb_populate_record(null::organization_memberships,${literal(membership)}::jsonb)`)
  expect((await readLegacyCutoverSource({ ...scope, supabase: client(memberId, "authenticated") })).fileId).toBe(captured.source.fileId)
  expect(sql(`select to_jsonb(m) from organization_memberships m where org_id=${literal(orgId)} and member_id=${literal(memberId)}`)).toBe(membership)
  expect((await readLegacyCutoverSource(scope)).fileId).toBe(captured.source.fileId)
  expect(sql("select count(*) from organization_private_storage_cutovers")).toBe("0")
  expect(sql("select count(*) from document_file_folder_authorities")).toBe("0")
  expect(sql("select to_regprocedure('public.assert_legacy_folder_binding_admission(uuid)') is null")).toBe("t")
  expect(sql("select count(*) from legacy_document_upload_stages where state in('staged','abandoned')")).toBe("0")
}, 30000)
