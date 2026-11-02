import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

// Explicitly provision workspace-sharing-commit-fixture.sql in a disposable
// local DB first. Never infer a database connection from application secrets.
const databaseUrl = process.env.WORKSPACE_SHARING_TEST_DATABASE_URL
const clients = new Set<ChildProcessWithoutNullStreams>()
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const graph = JSON.stringify({ workspaceId: id(1), particles: [{ id: id(20), title: "Saved" }] })
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
function commit(revision: number, intent: string, operation: number, actor = 1) {
  return `set role service_role; select public.fixture_page_commit(${revision},'${intent}','${id(operation)}','${id(actor)}')`
}
// Prove a competing transaction reached the relevant lock without sleeps or
// repeated status polling; a short lock_timeout is a deterministic probe.
async function assertBlocked(sql: string) {
  const blocked = await query(`set lock_timeout='150ms'; ${sql};`)
  expect(blocked.code).not.toBe(0)
  expect(blocked.stderr).toContain("lock timeout")
}

describe.skipIf(!databaseUrl)("workspace page concurrent database commits", () => {
  beforeAll(async () => {
    const guard = await query(`do $$ begin
      if current_database() not like 'workspace_sharing_fixture_%'
        or current_setting('coach_house.workspace_sharing_fixture') <> 'isolated-test-only'
        or to_regprocedure('public.fixture_page_commit(integer,text,uuid,uuid,jsonb,text,jsonb,jsonb,uuid)') is null then
        raise exception 'Marked isolated sharing fixture required';
      end if; end $$;`)
    expect(guard.code, guard.stderr).toBe(0)
  })
  beforeEach(async () => {
    const reset = await query(`delete from public.organization_workspace_pages;
      update public.organizations set updated_at='2026-10-16T18:30:00Z' where user_id='${id(1)}';
      update public.organization_memberships set role='admin' where member_id='${id(3)}';
      update public.organization_external_documents set status='available',updated_at='2026-10-16T18:30:00Z' where id='${id(40)}';
      update public.organization_workspace_boards set state=jsonb_build_object('particleGraph','${graph}'::jsonb);
      ${commit(0, "save_draft", 30)};`)
    expect(reset.code, reset.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  const guest = (actor: number, command: Record<string, unknown>) => `set role service_role; select public.workspace_page_guest_command('${id(actor)}','${id(10)}','${JSON.stringify(command)}'::jsonb,repeat('b',64))`
  async function inviteEditor() {
    const setup = await query(`${commit(1, "share_with_guests", 130)};
      ${guest(1, { action: "invite", operationId: id(131), invitationId: id(201), permission: "edit", email: "person7@example.org" })};
      ${guest(7, { action: "accept", invitationId: id(201) })};`)
    expect(setup.code, setup.stderr).toBe(0)
  }
  it("serializes guest edit against revocation and denies the queued edit", async () => {
    await inviteEditor()
    const release = await heldTransaction(guest(1, { action: "revoke", operationId: id(132), invitationId: id(201) }))
    const edit = guest(7, { action: "edit", operationId: id(133), expectedRevision: 2, title: "Guest draft", description: "" })
    await assertBlocked(edit); await release()
    const denied = await query(edit)
    expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Page unavailable")
    expect((await query(`select title from public.organization_workspace_pages`)).stdout.trim()).toBe("Gather together")
  })
  it("serializes guest details against owner publication and rejects stale review", async () => {
    await inviteEditor()
    const release = await heldTransaction(guest(7, { action: "edit", operationId: id(134), expectedRevision: 2, title: "Guest draft", description: "" }))
    await assertBlocked(commit(2, "publish", 135)); await release()
    const stale = await query(commit(2, "publish", 135))
    expect(stale.code).not.toBe(0); expect(stale.stderr).toContain("Page changed")
    expect((await query(`select title||':'||visibility from public.organization_workspace_pages`)).stdout.trim()).toBe("Guest draft:private")
  })

  it("serializes named-canvas publication against canvas deletion", async () => {
    const setup = await query(`delete from public.organization_workspace_pages;
      update public.organization_workspace_boards set state=jsonb_build_object('particleGraph','${graph}'::jsonb,
        'workspaceCatalog',jsonb_build_object('version',1,'defaultName','Main','entries',jsonb_build_array(
          jsonb_build_object('id','${id(70)}','state',jsonb_build_object('particleGraph','${graph}'::jsonb)))));`)
    expect(setup.code, setup.stderr).toBe(0)
    const publish = `set role service_role; select public.fixture_page_commit(0,'publish','${id(31)}',canvas=>'${id(70)}')`
    const release = await heldTransaction(publish)
    await assertBlocked(`update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries}','[]')`)
    await release()
    expect((await query(`select canvas_id::text||':'||visibility from public.organization_workspace_pages`)).stdout.trim()).toBe(`${id(70)}:public`)
    expect((await query(`update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries}','[]')`)).code).toBe(0)
    const stale = await query(`set role service_role; select public.fixture_page_commit(1,'publish','${id(32)}',canvas=>'${id(70)}')`)
    expect(stale.code).not.toBe(0); expect(stale.stderr).toContain("Canvas unavailable")
    expect((await query(`set role service_role; select public.fixture_page_commit(1,'make_private','${id(33)}',canvas=>'${id(70)}')`)).code).toBe(0)
  })
  it("rejects named-canvas stale publication after a competing source edit commits", async () => {
    expect((await query(`delete from public.organization_workspace_pages;
      update public.organization_workspace_boards set state=jsonb_build_object('particleGraph','${graph}'::jsonb,
        'workspaceCatalog',jsonb_build_object('version',1,'defaultName','Main','entries',jsonb_build_array(
          jsonb_build_object('id','${id(70)}','state',jsonb_build_object('particleGraph','${graph}'::jsonb)))));`)).code).toBe(0)
    const release = await heldTransaction(`update public.organization_workspace_boards set state=jsonb_set(state,'{workspaceCatalog,entries,0,state,particleGraph,particles,0,title}','"Changed"')`)
    const publish = `set role service_role; select public.fixture_page_commit(0,'publish','${id(31)}',canvas=>'${id(70)}')`
    await assertBlocked(publish); await release()
    const stale = await query(publish)
    expect(stale.code).not.toBe(0); expect(stale.stderr).toContain("Board changed")
    expect((await query("select count(*) from public.organization_workspace_pages")).stdout.trim()).toBe("0")
  })

  it("serializes Publish then a competing stale Private command without partial writes", async () => {
    const release = await heldTransaction(commit(1, "publish", 31))
    await assertBlocked(commit(1, "make_private", 32))
    await release()
    const stale = await query(commit(1, "make_private", 32))
    expect(stale.code).not.toBe(0)
    expect(stale.stderr).toContain("Page changed")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("public:2")
  })
  it("never resurrects a page when stale Publish races a confirmed revocation", async () => {
    expect((await query(commit(1, "publish", 31))).code).toBe(0)
    const release = await heldTransaction(commit(2, "make_private", 32))
    await assertBlocked(commit(2, "publish", 33))
    await release()
    const stale = await query(commit(2, "publish", 33))
    expect(stale.code).not.toBe(0)
    expect(stale.stderr).toContain("Page changed")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("private:3")
  })
  it("waits for a current membership downgrade and then denies the write", async () => {
    const release = await heldTransaction(`update public.organization_memberships set role='member' where member_id='${id(3)}'`)
    await assertBlocked(commit(1, "publish", 31, 3))
    await release()
    const denied = await query(commit(1, "publish", 31, 3))
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Organization editor required")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("private:1")
  })
  it("waits for a board edit and rejects the now-stale publication projection", async () => {
    const release = await heldTransaction("update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles,0,title}','\"Changed\"')")
    await assertBlocked(commit(1, "publish", 31))
    await release()
    const denied = await query(commit(1, "publish", 31))
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Board changed")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("private:1")
  })
  it("serializes duplicate successful requests as one publication", async () => {
    const release = await heldTransaction(commit(1, "publish", 31))
    await assertBlocked(commit(1, "publish", 31))
    await release()
    const retry = await query(commit(1, "publish", 31))
    expect(retry.code).toBe(0)
    expect(JSON.parse(retry.stdout.trim()).replayed).toBe(true)
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("public:2")
  })
  it("waits for an organization edit and requires a fresh publication review", async () => {
    const release = await heldTransaction(`update public.organizations set updated_at='2026-10-16T19:00:00Z' where user_id='${id(1)}'`)
    await assertBlocked(commit(1, "publish", 31))
    await release()
    const denied = await query(commit(1, "publish", 31))
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Organization changed")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("private:1")
  })
  it("locks canonical Drive metadata and rejects removal before Publish commits", async () => {
    const checks = JSON.stringify([{ id: id(40), provider_file_id: "canonicalFile01",
      web_view_link: "https://docs.google.com/document/d/canonicalFile01/edit", updated_at: "2026-10-16T18:30:00Z" }])
    const publish = `set role service_role; select public.fixture_page_commit(1,'publish','${id(31)}',drive_checks=>'${checks}')`
    const release = await heldTransaction(`update public.organization_external_documents set status='removed' where id='${id(40)}'`)
    await assertBlocked(publish)
    await release()
    const denied = await query(publish)
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Drive source changed")
    expect((await query("select visibility||':'||revision from public.organization_workspace_pages;")).stdout.trim()).toBe("private:1")
  })
  describe.runIf(process.env.WORKSPACE_SHARING_IMAGE_TESTS === "true")("reviewed image races", () => {
    beforeEach(async () => {
      const setup = await query("select public.fixture_image_sources();")
      expect(setup.code, setup.stderr).toBe(0)
    })
    const imageCommit = (rev: number, intent: string, op: number) =>
      `set role service_role; select public.fixture_image_commit(${rev},'${intent}',${op})`
    it("waits for source deletion and rolls back the entire publication", async () => {
      const release = await heldTransaction(`update public.organization_document_files set deleted_at=now() where id='${id(50)}'`)
      await assertBlocked(imageCommit(1, "publish", 150)); await release()
      const denied = await query(imageCommit(1, "publish", 150))
      expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Image source changed")
      expect((await query("select visibility||':'||revision from public.organization_workspace_pages")).stdout.trim()).toBe("private:1")
      expect((await query("select count(*) from public.workspace_page_image_grants")).stdout.trim()).toBe("0")
    })
    it("commits one grant for simultaneous identical publish requests", async () => {
      const release = await heldTransaction(imageCommit(1, "publish", 151))
      await assertBlocked(imageCommit(1, "publish", 151)); await release()
      const replay = await query(imageCommit(1, "publish", 151))
      expect(replay.code, replay.stderr).toBe(0)
      expect(JSON.parse(replay.stdout.trim()).replayed).toBe(true)
      expect((await query("select count(*) from public.workspace_page_image_grants")).stdout.trim()).toBe("1")
    })
    it("skips a locked orphan and never collects a fresh upload", async () => {
      expect((await query(`update storage.objects set created_at=now()-interval '2 days' where name like '%000000000063.webp'`)).code).toBe(0)
      const release = await heldTransaction(`select id from storage.objects where name like '%000000000063.webp' for share`)
      const during = await query("set role service_role; select public.workspace_page_image_orphans()")
      expect(during.code, during.stderr).toBe(0); expect(JSON.parse(during.stdout.trim())).toEqual([])
      await release()
      const after = await query("set role service_role; select public.workspace_page_image_orphans()")
      expect(after.code, after.stderr).toBe(0); expect(JSON.parse(after.stdout.trim())).toHaveLength(1)
    })
  })
  describe.runIf(process.env.WORKSPACE_SHARING_DOCUMENT_TESTS === "true")("reviewed document races", () => {
    beforeEach(async () => {
      const setup = await query("select public.fixture_document_sources();")
      expect(setup.code, setup.stderr).toBe(0)
    })
    const documentCommit = (rev: number, intent: string, op: number) =>
      `set role service_role; select public.fixture_document_commit(${rev},'${intent}',${op})`
    it("waits for source deletion and rolls back the entire publication", async () => {
      const release = await heldTransaction(`update public.organization_document_files set deleted_at=now() where id='${id(50)}'`)
      await assertBlocked(documentCommit(1, "publish", 150)); await release()
      const denied = await query(documentCommit(1, "publish", 150))
      expect(denied.code).not.toBe(0); expect(denied.stderr).toContain("Document source changed")
      expect((await query("select visibility||':'||revision from public.organization_workspace_pages")).stdout.trim()).toBe("private:1")
      expect((await query("select count(*) from public.workspace_page_document_grants")).stdout.trim()).toBe("0")
    })
    it("commits one grant for simultaneous identical publish requests", async () => {
      const release = await heldTransaction(documentCommit(1, "publish", 151))
      await assertBlocked(documentCommit(1, "publish", 151)); await release()
      const replay = await query(documentCommit(1, "publish", 151))
      expect(replay.code, replay.stderr).toBe(0)
      expect(JSON.parse(replay.stdout.trim()).replayed).toBe(true)
      expect((await query("select count(*) from public.workspace_page_document_grants")).stdout.trim()).toBe("1")
    })
    it("skips a locked orphan and never collects a fresh upload", async () => {
      expect((await query(`update storage.objects set created_at=now()-interval '2 days' where name like '%000000000063.txt'`)).code).toBe(0)
      const release = await heldTransaction(`select id from storage.objects where name like '%000000000063.txt' for share`)
      const during = await query("set role service_role; select public.workspace_page_image_orphans()")
      expect(during.code, during.stderr).toBe(0); expect(JSON.parse(during.stdout.trim())).toEqual([])
      await release()
      const after = await query("set role service_role; select public.workspace_page_image_orphans()")
      expect(after.code, after.stderr).toBe(0); expect(JSON.parse(after.stdout.trim())).toHaveLength(1)
    })
  })

})
