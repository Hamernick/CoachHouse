import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"

const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)

// Provision organization-closure-people-fixture.sql, never an app database.
describe.skipIf(!databaseUrl)("closure people taxonomy serialization", () => {
  beforeEach(async () => {
    const result = await query("select public.fixture_closure_people()")
    expect(result.code, result.stderr).toBe(0)
  })
  afterEach(() => { for (const child of clients) child.kill("SIGTERM") })

  for (const [kind, id] of [["tag", 810], ["segment", 820]] as const) {
    const parent = `public.organization_people_${kind}s`
    const members = `public.organization_people_${kind}_members`
    const key = `${kind}_id`
    const parentWrite = `update ${parent} set label='Admitted' where id=public.fixture_form_id(${id})`
    const memberWrite = `insert into ${members}(${key},person_id) values(public.fixture_form_id(${id}),'admitted')`
    it.each([["parent", parentWrite], ["member", memberWrite]])(`${kind}: finishes admitted %s writes before closure`, async (_name, sql) => {
      const release = await hold(sql)
      const closing = await queued("select public.fixture_closure('request',600,0)->>'state'")
      await release()
      const result = await closing.result
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout.trim()).toBe("closing")
    })
    it(`${kind}: rejects writes without lock inversion while closure owns the organization`, async () => {
      const release = await hold("select public.fixture_closure('request',600,0)")
      for (const sql of [parentWrite, memberWrite, `delete from ${parent} where id=public.fixture_form_id(${id})`,
        `delete from ${members} where ${key}=public.fixture_form_id(${id})`]) {
        const result = await query(sql)
        expect(result.code).not.toBe(0)
        expect(result.stderr).toContain("Organization is changing; retry people edit")
      }
      await release()
      const result = await query(parentWrite)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("Organization unavailable")
    })
    it(`${kind}: rechecks closure after waiting for a preexisting tuple lock`, async () => {
      const release = await hold(`select 1 from ${parent} where id=public.fixture_form_id(${id}) for update`)
      const writing = await queued(parentWrite)
      expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
      await release()
      const result = await writing.result
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("Organization unavailable")
    })
    it(`${kind}: rechecks member deletion after a preexisting tuple wait`, async () => {
      const release = await hold(`select 1 from ${members} where ${key}=public.fixture_form_id(${id}) for update`)
      const writing = await queued(`delete from ${members} where ${key}=public.fixture_form_id(${id})`)
      expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
      await release()
      const result = await writing.result
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("Organization unavailable")
    })
    it(`${kind}: retries after cancellation without restoring grants`, async () => {
      expect((await query("select public.fixture_closure('request',600,0)")).code).toBe(0)
      const release = await hold("select public.fixture_closure('cancel',601,1)")
      const denied = await query(memberWrite)
      expect(denied.stderr).toContain("Organization is changing; retry people edit")
      await release()
      const result = await query(`${memberWrite}; select visibility from public.organization_workspace_pages where id=public.fixture_form_id(10)`)
      expect(result.code, result.stderr).toBe(0)
      expect(result.stdout.trim()).toBe("private")
    })
  }
  it("does not block another organization's taxonomy while closing", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await query("update public.organization_people_tags set label='Other saved' where id=public.fixture_form_id(811)")
    expect(result.code, result.stderr).toBe(0)
    await release()
  })
  it("permits actual attribution cleanup during closure without admitting a disguised edit", async () => {
    const release = await hold("select public.fixture_closure('request',600,0)")
    const result = await query("delete from auth.users where id=public.fixture_form_id(12); select count(*) from public.organization_people_tag_members")
    expect(result.code, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe("1")
    await release()
    const denied = await query("update public.organization_people_tags set created_by=null,label='Disguised edit' where id=public.fixture_form_id(810)")
    expect(denied.stderr).toContain("Organization unavailable")
  })
  it.each(["repeatable read", "serializable"])("rejects fixed %s snapshots for parent and member writes", async (isolation) => {
    for (const sql of ["update public.organization_people_tags set label='Late' where id=public.fixture_form_id(810)",
      "delete from public.organization_people_segment_members where segment_id=public.fixture_form_id(820)"]) {
      const result = await query(`begin isolation level ${isolation}; ${sql}; commit;`)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain("Closure boundary requires read committed isolation")
    }
  })
})
