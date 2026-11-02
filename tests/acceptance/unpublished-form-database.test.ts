import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createClosureDatabaseHarness, databaseUrl } from "./organization-closure-database-helpers"
const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const id = (n: number) => `public.fixture_form_id(${n})`
const target = `'organizationId',${id(1)},'formId',${id(20)}`
let revision = ""
const save = () => `select public.organization_form_source_command(${id(2)},jsonb_build_object('action','save_form_source',${target},'operationId',${id(710)},'expectedRevision','${revision}','content',jsonb_build_object('title','Concurrent draft','description','','definition',jsonb_build_object('questions','[]'::jsonb))))`
const close = `select public.fixture_closure('request',900,0)`
const saved = `select state#>>'{particleGraph,particles,0,title}' from public.organization_workspace_boards where org_id=${id(1)}`

describe.skipIf(!databaseUrl)("direct unpublished draft closure ordering", () => {
  beforeEach(async () => {
    const setup = await query(`
      delete from public.organization_closure_operations; delete from public.organization_closures;
      update public.organization_workspace_boards set state='{}',updated_by=coalesce((select intake_manager from public.organization_forms where org_id=${id(1)} and id=${id(20)}),${id(1)});
      truncate public.organization_forms cascade; delete from public.organization_workspace_pages;
      insert into public.organization_memberships(org_id,member_id,role) values(${id(1)},${id(4)},'staff') on conflict(org_id,member_id) do update set role='staff';
      update public.organization_workspace_boards set state=jsonb_build_object('particleGraph',jsonb_build_object('revision',1,'workspaceId',${id(1)},'particles',jsonb_build_array(jsonb_build_object('id',${id(20)},'type','activity','title','Original draft','description','','revision',1,'data',jsonb_build_object('widget',jsonb_build_object('kind','form','definition',jsonb_build_object('questions','[]'::jsonb))))))),updated_by=${id(4)} where org_id=${id(1)};
      select public.organization_form_viewer_access(${id(4)},jsonb_build_object('action','invite_viewer',${target},'email','person2@example.org','responsePermission','edit','operationId',${id(700)},'expectedRevision',1));
      select public.organization_form_viewer_access(${id(2)},jsonb_build_object('action','accept_viewer',${target},'invitationId',${id(700)}));`)
    expect(setup.code, setup.stderr).toBe(0)
    const source = await query(`select public.organization_form_source_command(${id(2)},jsonb_build_object('action','read_form_source',${target}))->>'revision'`)
    expect(source.code, source.stderr).toBe(0); revision = source.stdout.trim(); expect(revision).toMatch(/^[a-f0-9]{64}$/)
  })
  afterEach(() => { for (const child of clients) child.kill() })
  it("commits an admitted draft before closure can acquire its organization fence", async () => {
    const release = await hold(save())
    const closing = await queued(close)
    await release()
    const result = await closing.result; expect(result.code, result.stderr).toBe(0)
    expect((await query(saved)).stdout.trim()).toBe("Concurrent draft")
    expect((await query(`select count(*) from public.organization_form_source_operations where operation_id=${id(710)}`)).stdout.trim()).toBe("1")
  })
  it("denies a queued direct draft write after closure commits without a receipt or source change", async () => {
    const release = await hold(close)
    const writing = await queued(save())
    await release()
    const result = await writing.result; expect(result.code).not.toBe(0); expect(result.stderr).toContain("Organization unavailable")
    expect((await query(saved)).stdout.trim()).toBe("Original draft")
    expect((await query(`select count(*) from public.organization_form_source_operations where operation_id=${id(710)}`)).stdout.trim()).toBe("0")
    expect((await query("select count(*) from public.organization_form_versions")).stdout.trim()).toBe("0")
  })
})
