import { spawn } from "node:child_process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { databaseUrl, createClosureDatabaseHarness } from "./organization-closure-database-helpers"
const { clients, query, hold, queued } = createClosureDatabaseHarness(spawn)
const mutate = "update storage.objects set metadata='{\"changed\":true}' where id=public.fixture_form_id(2601)"
const service = (sql: string) => `begin; set local role service_role; ${sql}; commit`
describe.skipIf(!databaseUrl)("organization Storage metadata admission", () => {
 beforeEach(async () => { const result=await query("select public.fixture_closure_storage()"); expect(result.code,result.stderr).toBe(0) })
 afterEach(() => { for(const child of clients) child.kill("SIGTERM") })
 it.each(["authenticated","service_role"])("finishes admitted %s Storage metadata effects before closure",async role=>{
  const release=await hold(`set local role ${role}; set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001'; ${mutate}`)
  const closing=await queued("select public.fixture_closure('request',600,0)->>'state'")
  await release();expect((await closing.result).stdout.trim()).toBe("closing")
  const denied=await query(service(mutate));expect(denied.code).not.toBe(0);expect(denied.stderr).toContain("Organization unavailable")
 })
 it("denies busy metadata mutation without a tuple/organization deadlock",async()=>{
  const release=await hold("select public.fixture_closure('request',600,0)")
  const denied=await query(service(mutate));expect(denied.code).not.toBe(0);expect(denied.stderr).toContain("changing")
  const other=await query(service(mutate.replace("2601","2602")));expect(other.code,other.stderr).toBe(0)
  await release()
 })
 it("rechecks after a Storage tuple wait instead of using an earlier closure snapshot",async()=>{
  const release=await hold("select 1 from storage.objects where id=public.fixture_form_id(2601) for update")
  const pending=await queued(service(mutate))
  const closing=await query("select public.fixture_closure('request',600,0)");expect(closing.code,closing.stderr).toBe(0)
  await release();const result=await pending.result;expect(result.code).not.toBe(0);expect(result.stderr).toContain("Organization unavailable")
 })
 it.each(["repeatable read","serializable"])("rejects %s Storage writes",async isolation=>{
  const result=await query(`begin isolation level ${isolation}; set local role service_role; ${mutate}; commit`)
  expect(result.code).not.toBe(0);expect(result.stderr).toContain("read committed")
 })
 it("cancel permits an explicit new write without restoring deleted grants or old bytes",async()=>{
  expect((await query("select public.fixture_closure('request',600,0); select public.fixture_closure('cancel',601,1)")).code).toBe(0)
  const result=await query(service(mutate));expect(result.code,result.stderr).toBe(0)
  expect((await query("select count(*) from public.workspace_page_image_grants where org_id=public.fixture_form_id(1)")).stdout.trim()).toBe("0")
 })
})
