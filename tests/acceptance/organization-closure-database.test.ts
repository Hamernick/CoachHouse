import { spawn } from "node:child_process"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, blocked, queued } = createClosureDatabaseHarness(spawn)

describe.skipIf(!databaseUrl)("organization closure database serialization", () => {
  beforeAll(async () => {
    const result = await query("select public.fixture_form_publish(0); select public.fixture_form_command('submit');")
    expect(result.code, result.stderr).toBe(0)
  })
  beforeEach(async () => {
    const result = await query("delete from public.organization_closure_operations; delete from public.organization_closures;")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  it("waits for an admitted response read before accepting closure", async () => {
    const release = await hold("select public.fixture_form_command('responses',1)")
    await blocked("select public.fixture_closure('request',600,0)")
    await release()
    const result = await query("select public.fixture_closure('request',600,0)->>'state'; select public.fixture_form_command('responses',1)#>>'{responses,0,answers,0,value}';")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n")).toEqual(["closing", "Joan"])
  })
  it("blocks a queued submission after closure wins, including an exact old retry", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    await blocked("select public.fixture_form_command('submit')")
    await release()
    const denied = await query("select public.fixture_form_command('submit')")
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Organization unavailable")
    expect((await query("select count(*) from public.organization_form_responses")).stdout.trim()).toBe("1")
  })
  it("reauthorizes queued exports without implicitly granting an owner response access", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    await blocked("select public.fixture_form_command('responses',1)")
    await release()
    const allowed = await query("select public.fixture_form_command('responses',1)#>>'{permissions,canCorrect}'")
    expect(allowed.code, allowed.stderr).toBe(0)
    expect(allowed.stdout.trim()).toBe("false")
    const denied = await query("select public.fixture_form_command('responses',2)")
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Form access required")
  })
  it("serializes two different closure requests without extending retention", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    await blocked("select public.fixture_closure('request',601,0)")
    await release()
    const denied = await query("select public.fixture_closure('request',601,0)")
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Closure changed")
    expect((await query("select count(*) from public.organization_closure_operations")).stdout.trim()).toBe("1")
  })
  it("serializes cancel against new writes and rejects an old cancel after reclosure", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    await blocked("select public.guard_organization_closure(public.fixture_form_id(1),false)")
    await release()
    const result = await query("select public.guard_organization_closure(public.fixture_form_id(1),false); select public.fixture_closure('request',602,2)->>'state'; select public.fixture_closure('cancel',601,1)->>'state';")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim().split("\n")).toEqual(["f", "closing", "closing"])
  })
  it("uses the wall clock even when a transaction began before the deadline", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const result = await query(`begin; update public.organization_closures
      set requested_at=statement_timestamp()-interval '720 hours'+interval '50 milliseconds',
          export_until=statement_timestamp()+interval '50 milliseconds';
      select pg_sleep(0.1); select public.fixture_form_command('responses',1); commit;`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
  })
})

// Same disposable chain, now including 20261102040000. These schedules execute
// the actual service RPCs with independent PostgreSQL sessions.
describe.skipIf(!databaseUrl)("closure publication serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_publication()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  const pageRead = "select public.read_workspace_page_public('community-table',public.fixture_form_id(10)) is null"

  it("withdraws a publication admitted before closure and keeps the form export", async () => {
    const release = await hold("select public.fixture_form_publish(1,'publish',81)")
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
    const read = await query(`${pageRead}; select public.fixture_form_command('responses',1)#>>'{responses,0,answers,0,value}'`)
    expect(read.code, read.stderr).toBe(0)
    expect(read.stdout.trim().split("\n")).toEqual(["t", "Joan"])
  })
  it("denies a queued publication when closure commits first", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const publishing = await queued("select public.fixture_form_publish(1,'publish',81)")
    await release()
    const result = await publishing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query(pageRead)).stdout.trim()).toBe("t")
  })
  it.each([
    ["public page", pageRead],
    ["public image", "select public.read_workspace_page_image(public.fixture_form_id(60),'public') is null"],
    ["guest document", "select public.read_workspace_page_document(public.fixture_form_id(61),'guest',public.fixture_form_id(6)) is null"],
  ])("withholds a queued %s after closure commits", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const reading = await queued(sql)
    await release()
    const result = await reading.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("t")
  })
  it.each([
    ["public page", pageRead],
    ["public image", "select public.read_workspace_page_image(public.fixture_form_id(60),'public')"],
    ["guest document", "select public.read_workspace_page_document(public.fixture_form_id(61),'guest',public.fixture_form_id(6))"],
  ])("waits for an admitted %s read before withdrawing grants", async (_name, sql) => {
    const release = await hold(sql)
    await blocked("select public.fixture_closure('request',600,0)")
    await release()
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    expect((await query(pageRead)).stdout.trim()).toBe("t")
  })
  it("rejects a queued guest read and preserves revocation after cancel", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const reading = await queued("select public.workspace_page_guest_command(public.fixture_form_id(6),public.fixture_form_id(10),'{\"action\":\"read\"}',null)")
    await release()
    expect((await reading.result).stderr).toContain("Organization unavailable")
    const canceled = await query(`select public.fixture_closure('cancel',601,1); ${pageRead};`)
    expect(canceled.code, canceled.stderr).toBe(0)
    expect(canceled.stdout.trim().split("\n").at(-1)).toBe("t")
    const denied = await query("select public.workspace_page_guest_command(public.fixture_form_id(6),public.fixture_form_id(10),'{\"action\":\"read\"}',null)")
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Review and save a guest preview first")
  })
})

describe.skipIf(!databaseUrl)("closure canonical writer serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_publication()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  const boardWrite = "update public.organization_workspace_boards set state=state||'{\"late\":true}' where org_id=public.fixture_form_id(1)"
  const sourceRead = "select public.organization_form_source_command(public.fixture_form_id(1),jsonb_build_object('action','read_form_source','versionId',public.fixture_form_id(80)))"

  it.each([
    ["direct board write", boardWrite],
    ["source read", sourceRead],
    ["reviewer grant", "select public.organization_form_review_access(public.fixture_form_id(1),jsonb_build_object('action','grant_reviewer','versionId',public.fixture_form_id(80)))"],
    ["invitation acceptance", "select public.organization_form_viewer_access(public.fixture_form_id(2),jsonb_build_object('action','accept_viewer','versionId',public.fixture_form_id(80)))"],
    ["owner recovery", "select public.organization_form_recovery(public.fixture_form_id(1),jsonb_build_object('action','recover_form','pageId',public.fixture_form_id(10),'formId',public.fixture_form_id(20)))"],
  ])("denies queued %s after closure wins", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(sql)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
  })
  it("rejects closure atomically when a direct board writer owns the row, then retries once", async () => {
    const release = await hold(boardWrite)
    const denied = await query("select public.fixture_closure('request',600,0)")
    expect(denied.code).not.toBe(0)
    expect(denied.stderr).toContain("Workspace is changing; retry closure")
    const before = await query("select count(*) from public.organization_closures; select count(*) from public.organization_closure_operations; select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")
    expect(before.stdout.trim().split("\n")).toEqual(["0", "0", "public"])
    // The writer can still create a form (org FK KEY SHARE) after closure's
    // failed attempt. Waiting on the board while owning org UPDATE would hang.
    await release(`update public.organization_workspace_boards set state=jsonb_set(state,'{particleGraph,particles}',
      (state#>'{particleGraph,particles}')||jsonb_set(state#>'{particleGraph,particles,0}','{id}',to_jsonb(public.fixture_form_id(25)))),
      updated_by=public.fixture_form_id(1) where org_id=public.fixture_form_id(1)`)
    const closed = await query("select public.fixture_closure('request',600,0)->>'state'; select count(*) from public.organization_closure_operations; select state->>'late' from public.organization_workspace_boards where org_id=public.fixture_form_id(1)")
    expect(closed.code, closed.stderr).toBe(0)
    expect(closed.stdout.trim().split("\n")).toEqual(["closing", "1", "true"])
  })
  it("finishes an admitted canonical source save before closure", async () => {
    const release = await hold(`select public.organization_form_source_command(public.fixture_form_id(1),jsonb_build_object(
      'action','save_form_source','versionId',public.fixture_form_id(80),'operationId',public.fixture_form_id(750),
      'expectedRevision',public.organization_form_source_token((select state from public.organization_workspace_boards where org_id=public.fixture_form_id(1)),public.fixture_form_id(20)),
      'content',jsonb_build_object('title','Admitted source','description','','definition',(select version->'definition' from public.organization_form_versions where id=public.fixture_form_id(80)))))`)
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    expect((await closing.result).stdout.trim()).toBe("closing")
    const read = await query("select state#>>'{particleGraph,particles,0,title}' from public.organization_workspace_boards where org_id=public.fixture_form_id(1); select count(*) from public.organization_form_source_operations")
    expect(read.stdout.trim().split("\n")).toEqual(["Admitted source", "1"])
  })
  it("waits for first board insertion admitted before closure", async () => {
    const release = await hold("insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(2),'{}',public.fixture_form_id(2))")
    const closing = await queued("select public.fixture_closure('request',600,0,2,2)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
  })
  it("rejects first board insertion queued behind closure", async () => {
    const release = await hold("select public.fixture_closure('request',600,0,2,2)")
    const inserting = await queued("insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(2),'{}',public.fixture_form_id(2))")
    await release()
    const result = await inserting.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
  })
  it("leaves an unrelated organization's admitted writer alone", async () => {
    const release = await hold("insert into public.organization_workspace_boards(org_id,state,updated_by) values(public.fixture_form_id(2),'{}',public.fixture_form_id(2))")
    const result = await query("select public.fixture_closure('request',600,0)->>'state'")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
    await release()
  })
  it.each(["repeatable read", "serializable"])("fails closed under %s instead of trusting a fixed pre-closure snapshot", async (isolation) => {
    for (const sql of [boardWrite, "select public.fixture_form_command('responses',1)"]) {
      const result = await query(`begin isolation level ${isolation}; ${sql}; commit;`)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("Closure boundary requires read committed isolation")
    }
  })
  it("reauthorizes queued response navigation at the fixed export deadline", async () => {
    const release = await hold("select public.fixture_closure('request',600,0); update public.organization_closures set requested_at=statement_timestamp()-interval '721 hours',export_until=statement_timestamp()-interval '1 hour'")
    const reading = await queued("select public.list_organization_form_response_versions(public.fixture_form_id(1),public.fixture_form_id(80))")
    await release()
    const result = await reading.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
  })
})


describe.skipIf(!databaseUrl)("closure organization profile serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_publication()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })
  const profileWrite = "update public.organizations set profile=profile||'{\"profileSaved\":true}' where user_id=public.fixture_form_id(1)"
  it.each([
    ["canonical profile save", profileWrite],
    ["profile UPSERT", "insert into public.organizations(user_id,profile) values(public.fixture_form_id(1),'{}') on conflict(user_id) do update set profile=excluded.profile"],
    ["organization deletion", "delete from public.organizations where user_id=public.fixture_form_id(1)"],
  ])("denies queued %s after closure commits", async (_name, sql) => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const writing = await queued(sql)
    await release()
    const result = await writing.result
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Organization unavailable")
    expect((await query("select count(*) from public.organization_form_responses")).stdout.trim()).toBe("1")
  })
  it("finishes an admitted canonical profile save before closure", async () => {
    const release = await hold(profileWrite)
    const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
    await release()
    const result = await closing.result
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("closing")
    expect((await query("select profile->>'profileSaved' from public.organizations where user_id=public.fixture_form_id(1)")).stdout.trim()).toBe("true")
  })
  it("allows a queued save after explicit cancellation without restoring publication", async () => {
    expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
    const release = await hold("select public.fixture_closure('cancel',601,1)")
    const writing = await queued(profileWrite)
    await release()
    const result = await writing.result
    expect(result.code, result.stderr).toBe(0)
    expect((await query("select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)")).stdout.trim()).toBe("private")
  })
  it("does not block another organization's canonical profile while closing", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await query("update public.organizations set profile=profile||'{\"unrelatedSaved\":true}' where user_id=public.fixture_form_id(2) returning profile->>'unrelatedSaved'")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("true")
    await release()
  })
  it.each(["repeatable read", "serializable"])("rejects %s canonical writes instead of retaining a stale lifecycle snapshot", async (isolation) => {
    const result = await query(`begin isolation level ${isolation}; ${profileWrite}; commit;`)
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("Closure boundary requires read committed isolation")
  })
})
