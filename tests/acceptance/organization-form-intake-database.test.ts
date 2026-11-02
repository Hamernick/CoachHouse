import { createParticle, emptyParticleGraph, readParticleGraph } from "@/features/workspace-particles"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

// Explicitly provision organization-form-source-authoring-fixture.sql in a disposable
// local DB first. Never infer a database connection from application secrets.
const databaseUrl = process.env.FORM_INTAKE_TEST_DATABASE_URL
const clients = new Set<ChildProcessWithoutNullStreams>()
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
function client() {
  if (!databaseUrl) throw new Error("An explicit isolated fixture connection is required.")
  const url = new URL(databaseUrl)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    || !/^\/workspace_sharing_fixture_[a-z0-9_]+$/.test(url.pathname) || url.password)
    throw new Error("Only a disposable local workspace-sharing fixture without credentials is allowed.")
  const child = spawn("psql", ["--no-psqlrc", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", databaseUrl], {
    env: { ...process.env, PGOPTIONS: "-c statement_timeout=5000 -c coach_house.workspace_sharing_fixture=isolated-test-only" },
  })
  clients.add(child)
  let stdout = "", stderr = ""
  const completion = new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString() })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString() })
    child.on("error", reject)
    child.on("close", (code) => { clients.delete(child); resolve({ code, stdout, stderr }) })
  })
  return { child, completion }
}
function query(sql: string) {
  const session = client()
  session.child.stdin.end(sql + "\n")
  return session.completion
}
async function heldTransaction(sql: string) {
  const session = client()
  await new Promise<void>((resolve, reject) => {
    let output = ""
    session.child.stdout.on("data", (chunk) => {
      output += chunk.toString()
      if (output.includes("__LOCKED__")) resolve()
    })
    session.completion.then((result) => reject(new Error(result.stderr || "Transaction ended before lock.")), reject)
    session.child.stdin.write(`begin; ${sql}; select '__LOCKED__';\n`)
  })
  return async () => {
    session.child.stdin.end("commit;\n")
    expect((await session.completion).code).toBe(0)
  }
}
// Prove a competing transaction reached the relevant lock without sleeps or
// repeated status polling; a short lock_timeout is a deterministic probe.
async function assertBlocked(sql: string) {
  const blocked = await query(`set lock_timeout='150ms'; ${sql};`)
  expect(blocked.code).not.toBe(0)
  expect(blocked.stderr).toContain("lock timeout")
}


describe.skipIf(!databaseUrl)("native form transaction races", () => {
  beforeAll(async () => {
    expect((await query(`select to_regprocedure('public.fixture_form_publish(integer,text,integer,integer,boolean)') is not null;`)).stdout.trim()).toBe("t")
  })
  beforeEach(async () => {
    const result = await query(`update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1); truncate public.organization_forms cascade; delete from public.organization_workspace_pages; select public.fixture_form_publish(0);`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes double submission and returns one immutable receipt", async () => {
    const release = await heldTransaction(`select public.fixture_form_command('submit')`)
    await assertBlocked(`select public.fixture_form_command('submit')`)
    await release()
    expect((await query(`select public.fixture_form_command('submit')`)).code).toBe(0)
    expect((await query(`select count(*) from public.organization_form_responses`)).stdout.trim()).toBe("1")
  })
  it("rejects a correction based on a concurrently replaced revision", async () => {
    await query(`select public.fixture_form_command('submit')`)
    const release = await heldTransaction(`select public.fixture_form_command('correct',1)`)
    const other = `select public.fixture_form_command('correct',1,jsonb_build_object('operationId','${id(93)}'))`
    await assertBlocked(other); await release()
    const result = await query(other)
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("Response changed")
  })
  it.each(["make_private", "publish"])("%s fences a queued old-version submission", async (intent) => {
    const release = await heldTransaction(`select public.fixture_form_publish(1,'${intent}',81)`)
    await assertBlocked(`select public.fixture_form_command('submit')`); await release()
    const denied = await query(`select public.fixture_form_command('submit')`)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form unavailable")
    expect((await query(`select count(*) from public.organization_form_responses`)).stdout.trim()).toBe("0")
  })
})

const recoveryCommand = `select public.organization_form_recovery('${id(1)}',jsonb_build_object('action','recover_form','pageId','${id(10)}','formId','${id(20)}','operationId','${id(150)}','expectedRevision',1))`
describe.skipIf(!databaseUrl)("form manager recovery races", () => {
  beforeAll(async () => {
    expect((await query(`select to_regprocedure('public.organization_form_recovery(uuid,jsonb)') is not null;`)).stdout.trim()).toBe("t")
  })
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0,'publish',80,4);
      update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}';`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes duplicate recovery and records one ownership transition", async () => {
    const release = await heldTransaction(recoveryCommand)
    await assertBlocked(recoveryCommand); await release()
    expect((await query(recoveryCommand)).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_recoveries")).stdout.trim()).toBe("1")
    expect((await query("select manager_revision from public.organization_forms")).stdout.trim()).toBe("2")
  })
  it("rechecks an existing manager role after a concurrent restoration", async () => {
    const release = await heldTransaction(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(recoveryCommand); await release()
    const result = await query(recoveryCommand)
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("Form manager still active")
    expect((await query("select count(*) from public.organization_form_recoveries")).stdout.trim()).toBe("0")
  })
  it("fences rejoining a missing manager without restoring old response authority", async () => {
    expect((await query(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(4)}'`)).code).toBe(0)
    const release = await heldTransaction(recoveryCommand)
    const rejoin = `insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff')`
    await assertBlocked(rejoin); await release()
    expect((await query(rejoin)).code).toBe(0)
    const denied = await query("select public.fixture_form_command('responses',4)")
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
  })
})

const grantReview = `select public.organization_form_review_access('${id(1)}','{"action":"grant_reviewer","versionId":"${id(80)}","email":"person4@example.org","expectedRevision":1,"operationId":"${id(180)}"}')`
const revokeReview = `select public.organization_form_review_access('${id(1)}','{"action":"revoke_reviewer","versionId":"${id(80)}","memberId":"${id(4)}","expectedRevision":2,"operationId":"${id(181)}"}')`
describe.skipIf(!databaseUrl)("scoped review access races", () => {
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0); select public.fixture_form_command('submit');`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes a duplicate grant into one operation", async () => {
    const release = await heldTransaction(grantReview)
    await assertBlocked(grantReview); await release()
    expect((await query(grantReview)).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_access_operations")).stdout.trim()).toBe("1")
    expect((await query("select access_revision from public.organization_forms")).stdout.trim()).toBe("2")
  })
  it("fences response reads and version discovery behind revocation", async () => {
    expect((await query(grantReview)).code).toBe(0)
    const release = await heldTransaction(revokeReview)
    await assertBlocked("select public.fixture_form_command('responses',4)")
    await assertBlocked(`select public.list_organization_form_versions('${id(4)}','${id(10)}')`)
    await release()
    const denied = await query("select public.fixture_form_command('responses',4)")
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
    expect((await query(`select public.list_organization_form_versions('${id(4)}','${id(10)}')->'versions'`)).stdout.trim()).toBe("[]")
  })
  it("does not grant access after a concurrent membership removal", async () => {
    const release = await heldTransaction(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(grantReview); await release()
    const denied = await query(grantReview)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Choose an existing organization editor")
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("0")
  })
  it("fences source edits and corrections behind an Edit downgrade", async () => {
    const grantEdit = grantReview.replace('"expectedRevision":1', '"role":"edit","expectedRevision":1')
    expect((await query(grantEdit)).code).toBe(0)
    const downgrade = grantReview.replace('"expectedRevision":1', '"role":"view","expectedRevision":2').replace(id(180), id(182))
    const release = await heldTransaction(downgrade)
    const source = `update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Concurrent edit"'),updated_by='${id(4)}'`
    await assertBlocked(source)
    await assertBlocked("select public.fixture_form_command('correct',4)")
    await release()
    const edit = await query(source)
    expect(edit.code).not.toBe(0); expect(edit.stderr).toContain("Form source manager required")
    const correction = await query("select public.fixture_form_command('correct',4)")
    expect(correction.code).not.toBe(0); expect(correction.stderr).toContain("Form access required")
    expect((await query(grantEdit)).code).toBe(0)
    expect((await query("select role from public.organization_form_reviewers")).stdout.trim()).toBe("view")
  })
  it("lets an authorized edit finish before a waiting revoke, then rejects further edits", async () => {
    expect((await query(grantReview.replace('"expectedRevision":1', '"role":"edit","expectedRevision":1'))).code).toBe(0)
    const source = `update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Committed edit"'),updated_by='${id(4)}'`
    const release = await heldTransaction(source)
    await assertBlocked(revokeReview); await release()
    expect((await query(revokeReview)).code).toBe(0)
    const denied = await query(source.replace("Committed edit", "Later edit"))
    expect(denied.code).not.toBe(0)
    expect((await query("select state#>>'{particleGraph,particles,0,title}' from public.organization_workspace_boards")).stdout.trim()).toBe("Committed edit")
  })

  it("fences source editing behind concurrent organization-role removal", async () => {
    expect((await query(grantReview.replace('"expectedRevision":1', '"role":"edit","expectedRevision":1'))).code).toBe(0)
    const release = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    const source = `update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Demoted edit"'),updated_by='${id(4)}'`
    await assertBlocked(source); await release()
    const denied = await query(source)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form source access required")
  })

})

const grantManage = grantReview.replace('"expectedRevision":1', '"role":"manage","expectedRevision":1')
const delegateEdit = `select public.organization_form_review_access('${id(4)}','{"action":"grant_reviewer","versionId":"${id(80)}","email":"person3@example.org","role":"edit","expectedRevision":2,"operationId":"${id(220)}"}')`
const revokeManage = revokeReview.replace('"expectedRevision":2', '"expectedRevision":3')
const childSource = `update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','"Delegated draft"'),updated_by='${id(3)}'`
const demoteManager = `update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`
describe.skipIf(!databaseUrl)("bounded Manage delegation races", () => {
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by='${id(1)}';
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0); select public.fixture_form_command('submit'); ${grantManage}; ${delegateEdit};`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("revoking Manage fences child responses, edits and late delegation retries", async () => {
    const release = await heldTransaction(revokeManage)
    await assertBlocked(childSource)
    await assertBlocked("select public.fixture_form_command('responses',3)")
    await assertBlocked(delegateEdit)
    await release()
    for (const sql of [childSource, "select public.fixture_form_command('responses',3)", delegateEdit]) {
      expect((await query(sql)).code).not.toBe(0)
    }
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("0")
  })
  it.each(["demotion", "deletion"])("manager membership %s fences active child writes and reads", async (operation) => {
    const membership = operation === "demotion" ? demoteManager : `delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(4)}'`
    const release = await heldTransaction(membership)
    await assertBlocked(childSource)
    await assertBlocked("select public.fixture_form_command('correct',3)")
    await release()
    expect((await query(childSource)).code).not.toBe(0)
    expect((await query("select public.fixture_form_command('responses',3)")).code).not.toBe(0)
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("0")
  })
  it("a committed child edit survives a waiting manager demotion without deadlock", async () => {
    const release = await heldTransaction(childSource)
    await assertBlocked(demoteManager); await release()
    const result = await query(demoteManager)
    expect(result.code, result.stderr).toBe(0)
    expect((await query(childSource.replace("Delegated draft", "Later draft"))).code).not.toBe(0)
    expect((await query("select state#>>'{particleGraph,particles,0,title}' from public.organization_workspace_boards")).stdout.trim()).toBe("Delegated draft")
  })
  it("canonical adoption serializes before revocation and retains independently granted Edit", async () => {
    const adopt = delegateEdit.replace(id(4), id(1)).replace('"expectedRevision":2', '"expectedRevision":3').replace(id(220), id(221))
    const release = await heldTransaction(adopt)
    await assertBlocked(revokeManage); await release()
    const stale = await query(revokeManage)
    expect(stale.code).not.toBe(0); expect(stale.stderr).toContain("Access changed")
    expect((await query(revokeManage.replace('"expectedRevision":3', '"expectedRevision":4'))).code).toBe(0)
    expect((await query(childSource)).code).toBe(0)
    expect((await query("select member_id from public.organization_form_reviewers")).stdout.trim()).toBe(id(3))
  })
})

// The new address resolves directly to the saved canonical form, before any version exists.
describe.skipIf(!databaseUrl)("unpublished form access races", () => {
  const grant = `select public.organization_form_review_access('${id(1)}','${JSON.stringify({ action: "grant_reviewer", organizationId: id(1), formId: id(20), email: "person4@example.org", role: "edit", operationId: id(450), expectedRevision: 1 })}')`
  const revoke = `select public.organization_form_review_access('${id(1)}','${JSON.stringify({ action: "revoke_reviewer", organizationId: id(1), formId: id(20), memberId: id(4), operationId: id(451), expectedRevision: 2 })}')`
  const edit = `update public.organization_workspace_boards set updated_by='${id(4)}',state=jsonb_set(state,'{particleGraph,particles,0,title}','"Unpublished edit"')`
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by='${id(1)}';
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      update public.organization_workspace_boards set state='${JSON.stringify({ particleGraph: { particles: [{ id: id(20), type: "activity", title: "Private draft", data: { widget: { kind: "form", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } } } }] } })}',updated_by='${id(1)}';`)
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select count(*) from public.organization_form_versions")).stdout.trim()).toBe("0")
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("first publication waits for a source-target grant and retains its authority", async () => {
    const release = await heldTransaction(grant)
    await assertBlocked("select public.fixture_form_publish(0)")
    await release()
    const published = await query("select public.fixture_form_publish(0)")
    expect(published.code, published.stderr).toBe(0)
    expect((await query(edit)).code).toBe(0)
    const capability = await query("select public.fixture_form_command('responses',4)#>>'{permissions,canCorrect}'")
    expect(capability.code, capability.stderr).toBe(0)
    expect(capability.stdout.trim()).toBe("true")
    expect((await query("select access_revision from public.organization_forms")).stdout.trim()).toBe("2")
  })
  it("source-target revocation fences an unpublished editor save", async () => {
    expect((await query(grant)).code).toBe(0)
    const release = await heldTransaction(revoke)
    await assertBlocked(edit); await release()
    expect((await query(edit)).code).not.toBe(0)
    expect((await query(grant)).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("0")
    expect((await query("select count(*) from public.organization_form_versions")).stdout.trim()).toBe("0")
  })
})

describe.skipIf(!databaseUrl)("unpublished form recovery races", () => {
  const recover = `select public.organization_form_recovery('${id(1)}','${JSON.stringify({ action: "recover_form", organizationId: id(1), formId: id(20), operationId: id(460), expectedRevision: 1 })}')`
  beforeEach(async () => {
    const state = { particleGraph: { particles: [{ id: id(20), type: "activity", title: "Private draft", data: { widget: { kind: "form", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } } } }] } }
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      update public.organization_workspace_boards set state='${JSON.stringify(state)}',updated_by='${id(4)}';
      update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}';`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes duplicate source recovery without creating a publication", async () => {
    const release = await heldTransaction(recover)
    await assertBlocked(recover); await release()
    expect((await query(recover)).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_recoveries")).stdout.trim()).toBe("1")
    expect((await query("select count(*) from public.organization_form_versions")).stdout.trim()).toBe("0")
    expect((await query("select count(*) from public.organization_workspace_pages")).stdout.trim()).toBe("0")
  })
  it("refuses takeover after concurrent restoration of the original manager", async () => {
    const release = await heldTransaction(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(recover); await release()
    const result = await query(recover)
    expect(result.code).not.toBe(0); expect(result.stderr).toContain("Form manager still active")
    expect((await query("select count(*) from public.organization_form_recoveries")).stdout.trim()).toBe("0")
  })
  it("waits behind a board save, preserves it and enables the recovered owner's next save", async () => {
    const release = await heldTransaction(`update public.organization_workspace_boards set updated_by='${id(1)}',state=jsonb_set(state,'{fixtureLayout}','1')`)
    await assertBlocked(recover); await release()
    expect((await query(recover)).code).toBe(0)
    const saved = await query(`update public.organization_workspace_boards set updated_by='${id(1)}',state=jsonb_set(state,'{particleGraph,particles,0,title}','"Recovered edit"'); select state->>'fixtureLayout' from public.organization_workspace_boards`)
    expect(saved.code, saved.stderr).toBe(0); expect(saved.stdout.trim()).toBe("1")
  })
})

// Owners need an explicit form grant, but never an artificial membership row.
describe.skipIf(!databaseUrl)("explicit organization-owner form access races", () => {
  const grant = `select public.organization_form_review_access('${id(4)}','${JSON.stringify({ action: "grant_reviewer", organizationId: id(1), formId: id(20), email: "person1@example.org", role: "edit", operationId: id(510), expectedRevision: 1 })}')`
  const revoke = `select public.organization_form_review_access('${id(4)}','${JSON.stringify({ action: "revoke_reviewer", versionId: id(80), memberId: id(1), operationId: id(511), expectedRevision: 2 })}')`
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0,'publish',80,4); select public.fixture_form_command('submit');`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes an owner grant retry without creating membership or duplicate access", async () => {
    const release = await heldTransaction(grant)
    await assertBlocked(grant); await release()
    expect((await query(grant)).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("1")
    expect((await query("select count(*) from public.organization_form_access_operations")).stdout.trim()).toBe("1")
    expect((await query(`select count(*) from public.organization_memberships where member_id='${id(1)}'`)).stdout.trim()).toBe("0")
  })
  it("revocation fences owner answer corrections and old grant retries cannot restore access", async () => {
    expect((await query(grant)).code).toBe(0)
    const release = await heldTransaction(revoke)
    await assertBlocked("select public.fixture_form_command('correct',1)"); await release()
    const denied = await query("select public.fixture_form_command('correct',1)")
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
    expect((await query(grant)).code).toBe(0)
    expect((await query("select public.fixture_form_command('responses',1)")).code).not.toBe(0)
    expect((await query("select revision from public.organization_form_responses")).stdout.trim()).toBe("1")
  })
  it("primary-manager membership loss fences explicit owner access", async () => {
    expect((await query(grant)).code).toBe(0)
    const release = await heldTransaction(`delete from public.organization_memberships where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked("select public.fixture_form_command('responses',1)"); await release()
    expect((await query("select public.fixture_form_command('responses',1)")).code).not.toBe(0)
    expect((await query("select count(*) from public.organization_form_reviewers")).stdout.trim()).toBe("0")
  })
})

// Requires organization-form-response-versions-fixture.sql; external read scope stays
// separate from membership-backed Edit/Manage and never touches answer writers.
const viewerCommand = (action: string, actor = 4, operation = 600, revision = 1) =>
  `select public.organization_form_viewer_access('${id(actor)}','{"action":"${action}","versionId":"${id(80)}","email":"person2@example.org","operationId":"${id(operation)}","invitationId":"${id(600)}","expectedRevision":${revision}}')`
describe.skipIf(!databaseUrl)("invited form viewer races", () => {
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0,'publish',80,4); select public.fixture_form_command('submit');`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  const correctionInvitation = `select public.organization_form_viewer_access('${id(4)}','{"action":"invite_viewer","versionId":"${id(80)}","email":"person2@example.org","operationId":"${id(600)}","expectedRevision":1,"responsePermission":"correct"}')`
  const directory = `select public.list_accessible_organization_forms('${id(2)}','${id(80)}')`
  it("fences cross-form discovery behind anchor revocation and manager loss", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const releaseRead = await heldTransaction(directory)
    await assertBlocked(viewerCommand("revoke_viewer", 4, 601, 3)); await releaseRead()
    const releaseLoss = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(directory); await releaseLoss()
    expect((await query(directory)).code).not.toBe(0)
  })
  it("rechecks each neighboring form after its revocation lock", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const seeded = await query(`
      insert into public.organization_forms(org_id,id,intake_manager) values('${id(1)}','${id(21)}','${id(4)}');
      insert into public.organization_form_versions(id,org_id,form_id,page_id,version)
        select '${id(81)}',org_id,'${id(21)}',page_id,jsonb_set(version,'{title}','"Neighbor"') from public.organization_form_versions where id='${id(80)}';
      ${viewerCommand("invite_viewer", 4, 610).replaceAll(id(80), id(81))};
      ${viewerCommand("accept_viewer", 2).replaceAll(id(80), id(81)).replaceAll(id(600), id(610))};`)
    expect(seeded.code, seeded.stderr).toBe(0)
    const revokeNeighbor = viewerCommand("revoke_viewer", 4, 611, 3).replaceAll(id(80), id(81)).replaceAll(id(600), id(610))
    const releaseRead = await heldTransaction(directory)
    await assertBlocked(revokeNeighbor); await releaseRead()
    const releaseRevoke = await heldTransaction(revokeNeighbor)
    await assertBlocked(directory); await releaseRevoke()
    const result = await query(directory)
    expect(result.code, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout).forms.map((form: { formId: string }) => form.formId)).toEqual([id(20)])
  })
  it("serializes external correction against revoke in both orders", async () => {
    expect((await query(correctionInvitation)).code).toBe(0); await query(viewerCommand("accept_viewer", 2))
    const correction = "select public.fixture_form_command('correct',2)"
    const releaseCorrect = await heldTransaction(correction)
    await assertBlocked(viewerCommand("revoke_viewer", 4, 601, 3)); await releaseCorrect()
    const releaseRevoke = await heldTransaction(viewerCommand("revoke_viewer", 4, 601, 3))
    await assertBlocked(correction); await releaseRevoke()
    const denied = await query(correction)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
    expect((await query("select count(*) from public.organization_form_corrections")).stdout.trim()).toBe("1")
  })
  it("denies a correction queued behind a view-only replacement invitation", async () => {
    await query(correctionInvitation); await query(viewerCommand("accept_viewer", 2))
    const release = await heldTransaction(viewerCommand("invite_viewer", 4, 602, 3))
    await assertBlocked("select public.fixture_form_command('correct',2)"); await release()
    expect((await query("select public.fixture_form_command('correct',2)")).code).not.toBe(0)
    expect((await query("select count(*) from public.organization_form_corrections")).stdout.trim()).toBe("0")
  })
  it("denies a correction queued behind primary manager loss", async () => {
    await query(correctionInvitation); await query(viewerCommand("accept_viewer", 2))
    const release = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked("select public.fixture_form_command('correct',2)"); await release()
    expect((await query("select public.fixture_form_command('correct',2)")).code).not.toBe(0)
    expect((await query("select count(*) from public.organization_form_corrections")).stdout.trim()).toBe("0")
  })
  it("fences scoped version discovery in both revocation orders", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const read = `select public.list_organization_form_response_versions('${id(2)}','${id(80)}')`
    const releaseRead = await heldTransaction(read)
    await assertBlocked(viewerCommand("revoke_viewer", 4, 601, 3)); await releaseRead()
    const releaseRevoke = await heldTransaction(viewerCommand("revoke_viewer", 4, 601, 3))
    await assertBlocked(read); await releaseRevoke()
    const denied = await query(read)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
  })
  it("fences scoped version discovery against primary manager loss", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const read = `select public.list_organization_form_response_versions('${id(2)}','${id(80)}')`
    const release = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(read); await release()
    expect((await query(read)).code).not.toBe(0)
    await query(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(4)}'`)
    expect((await query(read)).code).not.toBe(0)
  })
  it("serializes duplicate invitations without replacing the pending identity", async () => {
    const release = await heldTransaction(viewerCommand("invite_viewer"))
    await assertBlocked(viewerCommand("invite_viewer")); await release()
    expect((await query(viewerCommand("invite_viewer"))).code).toBe(0)
    expect((await query("select count(*) from public.organization_form_viewer_invitations")).stdout.trim()).toBe("1")
    expect((await query("select access_revision from public.organization_forms")).stdout.trim()).toBe("2")
  })
  it("serializes duplicate acceptance without double revision changes", async () => {
    expect((await query(viewerCommand("invite_viewer"))).code).toBe(0)
    const release = await heldTransaction(viewerCommand("accept_viewer", 2))
    await assertBlocked(viewerCommand("accept_viewer", 2)); await release()
    expect((await query(viewerCommand("accept_viewer", 2))).code).toBe(0)
    expect((await query("select access_revision from public.organization_forms")).stdout.trim()).toBe("3")
  })
  it("rejects acceptance queued behind revocation", async () => {
    await query(viewerCommand("invite_viewer"))
    const release = await heldTransaction(viewerCommand("revoke_viewer", 4, 601, 2))
    await assertBlocked(viewerCommand("accept_viewer", 2)); await release()
    const denied = await query(viewerCommand("accept_viewer", 2))
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Invitation unavailable")
  })
  it("rejects a response read queued behind revocation", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const release = await heldTransaction(viewerCommand("revoke_viewer", 4, 601, 3))
    await assertBlocked("select public.fixture_form_command('responses',2)"); await release()
    const denied = await query("select public.fixture_form_command('responses',2)")
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form access required")
  })
  it("lets an already-authorized read finish before revocation then denies new reads", async () => {
    await query(viewerCommand("invite_viewer")); await query(viewerCommand("accept_viewer", 2))
    const release = await heldTransaction("select public.fixture_form_command('responses',2)")
    await assertBlocked(viewerCommand("revoke_viewer", 4, 601, 3)); await release()
    expect((await query(viewerCommand("revoke_viewer", 4, 601, 3))).code).toBe(0)
    expect((await query("select public.fixture_form_command('responses',2)")).code).not.toBe(0)
  })
  it("fences primary manager loss against pending acceptance", async () => {
    await query(viewerCommand("invite_viewer"))
    const release = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(viewerCommand("accept_viewer", 2)); await release()
    expect((await query(viewerCommand("accept_viewer", 2))).code).not.toBe(0)
    await query(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(4)}'`)
    expect((await query(viewerCommand("accept_viewer", 2))).code).not.toBe(0)
  })
})

describe.skipIf(!databaseUrl)("isolated form source authoring races", () => {
  const call = (actor: number, command: unknown) => `select public.organization_form_source_command('${id(actor)}','${JSON.stringify(command)}')`
  const read = call(2, { action: "read_form_source", versionId: id(80) })
  const content = { title: "Edited draft", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Full name", required: true }] } }
  const write = (revision: string, operationId = id(710)) => call(2, { action: "save_form_source", versionId: id(80), operationId, expectedRevision: revision, content })
  const revoke = `select public.organization_form_viewer_access('${id(4)}','${JSON.stringify({ action: "revoke_viewer", versionId: id(80), operationId: id(720), invitationId: id(700), expectedRevision: 3 })}')`
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0,'publish',80,4);
      select public.organization_form_viewer_access('${id(4)}','${JSON.stringify({ action: "invite_viewer", versionId: id(80), operationId: id(700), expectedRevision: 1, email: "person2@example.org", responsePermission: "edit" })}');
      select public.organization_form_viewer_access('${id(2)}','${JSON.stringify({ action: "accept_viewer", versionId: id(80), invitationId: id(700) })}');`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("preserves the production graph schema and increments the touched particle revision", async () => {
    const particle = createParticle("activity", { id: id(20), workspaceId: id(1), now: "2026-11-01T12:00:00.000Z" })
    if (particle.type !== "activity") throw new Error("Expected activity")
    const graph = { ...emptyParticleGraph(id(1)), particles: [{ ...particle, title: "Sign up", data: { ...particle.data, widget: { kind: "form", definition: content.definition } } }] }
    const seeded = await query(`update public.organization_workspace_boards set state='${JSON.stringify({ particleGraph: graph })}',updated_by='${id(4)}'`)
    expect(seeded.code, seeded.stderr).toBe(0)
    const source = JSON.parse((await query(read)).stdout)
    expect((await query(write(source.revision))).code).toBe(0)
    const saved = JSON.parse((await query("select state->'particleGraph' from public.organization_workspace_boards")).stdout)
    const validated = readParticleGraph(saved, id(1))
    expect(validated.ok).toBe(true)
    expect(saved.revision).toBe(1); expect(saved.particles[0].revision).toBe(1)
    expect(saved.particles[0].title).toBe(content.title)
    expect(saved.particles[0].createdAt).toBe(particle.createdAt)
  })
  it("serializes exact source retries and rejects competing stale drafts", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const release = await heldTransaction(write(source.revision))
    await assertBlocked(write(source.revision)); await release()
    expect((await query(write(source.revision))).code).toBe(0)
    const conflict = await query(write(source.revision, id(711)))
    expect(conflict.code).not.toBe(0); expect(conflict.stderr).toContain("Form changed")
    expect((await query("select count(*) from public.organization_form_source_operations")).stdout.trim()).toBe("1")
  })
  it("fences source saves and receipt retries behind invitation revocation", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const releaseSave = await heldTransaction(write(source.revision))
    await assertBlocked(revoke); await releaseSave()
    const releaseRevoke = await heldTransaction(revoke)
    await assertBlocked(write(source.revision)); await releaseRevoke()
    const denied = await query(write(source.revision))
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Form editing access required")
  })
  it("preserves a queued unrelated board change and rejects manager-loss source reads", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const releaseBoard = await heldTransaction(`update public.organization_workspace_boards set state=jsonb_set(state,'{layout}','"keep"'),updated_by='${id(4)}'`)
    await assertBlocked(write(source.revision)); await releaseBoard()
    expect((await query(write(source.revision))).code).toBe(0)
    expect((await query("select state->>'layout' from public.organization_workspace_boards")).stdout.trim()).toBe("keep")
    const releaseLoss = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(read); await releaseLoss()
    expect((await query(read)).code).not.toBe(0)
  })
})

// Provision organization-form-invited-managers-fixture.sql for this scope.
describe.skipIf(!databaseUrl)("invited form management races", () => {
  const access = (actor: number, command: unknown) => `select public.organization_form_viewer_access('${id(actor)}','${JSON.stringify(command)}')`
  const invite = (actor: number, person: number, role: string, op: number, revision: number) => access(actor, {
    action: "invite_viewer", versionId: id(80), email: `person${person}@example.org`, responsePermission: role, operationId: id(op), expectedRevision: revision,
  })
  const accept = (actor: number, invitation: number) => access(actor, { action: "accept_viewer", versionId: id(80), invitationId: id(invitation) })
  const revoke = (revision = 5) => access(4, { action: "revoke_viewer", versionId: id(80), invitationId: id(800), operationId: id(820), expectedRevision: revision })
  const read = `select public.organization_form_source_command('${id(6)}','${JSON.stringify({ action: "read_form_source", versionId: id(80) })}')`
  const write = (revision: string) => `select public.organization_form_source_command('${id(6)}','${JSON.stringify({ action: "save_form_source", versionId: id(80), operationId: id(830), expectedRevision: revision,
    content: { title: "Delegated edit", description: "", definition: { questions: [{ id: id(90), type: "text", label: "Name", required: true }] } } })}')`
  beforeEach(async () => {
    const result = await query(`
      insert into public.organization_memberships(org_id,member_id,role) values('${id(1)}','${id(4)}','staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id='${id(1)}' and id='${id(20)}'),'${id(1)}');
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      select public.fixture_form_publish(0,'publish',80,4); select public.fixture_form_command('submit');
      ${invite(4, 2, "manage", 800, 1)}; ${accept(2, 800)};
      ${invite(2, 6, "edit", 801, 3)}; ${accept(6, 801)};`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes identical invitations without duplicate children or receipts", async () => {
    const command = invite(2, 7, "view", 802, 5)
    const release = await heldTransaction(command)
    await assertBlocked(command); await release()
    expect((await query(command)).code).toBe(0)
    expect((await query(`select count(*) from public.organization_form_viewer_invitations where email='person7@example.org'`)).stdout.trim()).toBe("1")
    expect((await query(`select count(*) from public.organization_form_invitation_operations where operation_id='${id(802)}'`)).stdout.trim()).toBe("1")
  })
  it("revocation fences child reads, writes, corrections, acceptance and parent retries", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const release = await heldTransaction(revoke())
    await assertBlocked(read); await assertBlocked(write(source.revision))
    await assertBlocked(`select public.fixture_form_command('correct',6)`)
    await release()
    for (const command of [read, write(source.revision), `select public.fixture_form_command('responses',6)`, `select public.fixture_form_command('correct',6)`, accept(6, 801), invite(2, 6, "edit", 801, 3)]) {
      const denied = await query(command)
      expect(denied.code, command).not.toBe(0)
      expect(denied.stderr).toMatch(/access required|access unavailable|editing access required|Invitation unavailable|management required/i)
    }
  })
  it("preserves an acknowledged child save, then rejects its retry after revocation", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const release = await heldTransaction(write(source.revision))
    await assertBlocked(revoke()); await release()
    expect((await query(revoke())).code).toBe(0)
    expect((await query(write(source.revision))).code).not.toBe(0)
    expect((await query("select state#>>'{particleGraph,particles,0,title}' from public.organization_workspace_boards")).stdout.trim()).toBe("Delegated edit")
    expect((await query("select version->>'title' from public.organization_form_versions")).stdout.trim()).toBe("Sign up")
  })
  it("primary adoption survives subsequent delegate revocation and rejects stale child changes", async () => {
    const adoption = invite(4, 6, "edit", 803, 5)
    const release = await heldTransaction(adoption)
    await assertBlocked(revoke(6)); await release()
    const interference = await query(invite(2, 6, "view", 804, 6))
    expect(interference.code).not.toBe(0); expect(interference.stderr).toContain("Only access granted by you")
    expect((await query(revoke(6))).code).toBe(0)
    expect((await query(accept(6, 803))).code).toBe(0)
    expect((await query(read)).code).toBe(0)
  })
  it("downgrade fences acceptance and a later Manage grant never revives children", async () => {
    const release = await heldTransaction(invite(4, 2, "edit", 804, 5))
    await assertBlocked(accept(6, 801)); await release()
    expect((await query(accept(6, 801))).code).not.toBe(0)
    expect((await query(invite(4, 2, "manage", 805, 6))).code).toBe(0)
    expect((await query(accept(2, 805))).code).toBe(0)
    expect((await query(read)).code).not.toBe(0)
  })
  it("primary membership loss serializes child writes and cannot be undone by rejoining", async () => {
    const source = JSON.parse((await query(read)).stdout)
    const release = await heldTransaction(`update public.organization_memberships set role='member' where org_id='${id(1)}' and member_id='${id(4)}'`)
    await assertBlocked(write(source.revision)); await release()
    expect((await query(write(source.revision))).code).not.toBe(0)
    expect((await query(`update public.organization_memberships set role='staff' where org_id='${id(1)}' and member_id='${id(4)}'`)).code).toBe(0)
    expect((await query(read)).code).not.toBe(0)
  })
})

const deleteResponse = `select public.organization_form_intake('${id(1)}','{"action":"delete_response","versionId":"${id(80)}","id":"${id(91)}","expectedRevision":1,"operationId":"${id(500)}"}')`
describe.skipIf(!databaseUrl)("native response deletion races", () => {
  beforeEach(async () => {
    const result = await query(`update public.organization_workspace_boards set state='{}',updated_by=public.fixture_form_id(1); truncate public.organization_forms cascade; delete from public.organization_workspace_pages; select public.fixture_form_publish(0); select public.fixture_form_command('submit');`)
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("serializes duplicate deletion and permanently fences the old submission and correction", async () => {
    const release = await heldTransaction(deleteResponse)
    await assertBlocked(deleteResponse)
    await assertBlocked("select public.fixture_form_command('submit')")
    await assertBlocked("select public.fixture_form_command('correct',1)")
    await release()
    expect((await query(deleteResponse)).code).toBe(0)
    expect((await query("select public.fixture_form_command('submit')")).stderr).toContain("Submission deleted")
    expect((await query("select public.fixture_form_command('correct',1)")).stderr).toContain("Response unavailable")
    expect((await query("select count(*) from public.organization_form_responses")).stdout.trim()).toBe("0")
    expect((await query("select count(*) from public.organization_form_response_deletions")).stdout.trim()).toBe("1")
  })
  it("requires fresh review when a concurrent correction wins", async () => {
    const release = await heldTransaction("select public.fixture_form_command('correct',1)")
    await assertBlocked(deleteResponse); await release()
    expect((await query(deleteResponse)).stderr).toContain("Response changed")
    expect((await query("select count(*) from public.organization_form_responses")).stdout.trim()).toBe("1")
    expect((await query("select count(*) from public.organization_form_response_deletions")).stdout.trim()).toBe("0")
  })
  it("rechecks primary authority after a concurrent manager replacement", async () => {
    const release = await heldTransaction(`update public.organization_forms set intake_manager='${id(3)}',manager_revision=manager_revision+1`)
    await assertBlocked(deleteResponse); await release()
    expect((await query(deleteResponse)).stderr).toContain("Form access required")
    expect((await query("select count(*) from public.organization_form_responses")).stdout.trim()).toBe("1")
  })
})
