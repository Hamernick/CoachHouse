import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { userInfo } from "node:os"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import * as Y from "yjs"

const run = promisify(execFile)
const port = process.env.DOCUMENT_ROOM_TEST_PORT
async function sql(command: string) {
  if (!port || !/^[1-9]\d{3,4}$/.test(port) || Number(port)>65535 || port==="5432")
    throw new Error("Use the dedicated isolated fixture port, never a shared/app database.")
  const guard = "do $$ begin if current_setting('coach_house.document_room_fixture',true) is distinct from 'isolated-test-only' then raise exception 'Isolated fixture required'; end if; end $$;"
  const result = await run("psql", ["-X","-q","-A","-t","-h","127.0.0.1","-p",port,"-U",userInfo().username,"-d","postgres","-v","ON_ERROR_STOP=1","-c",guard+command], {timeout:20000,maxBuffer:1024*1024})
  return result.stdout.trim()
}

describe.skipIf(!port)("isolated PostgreSQL document rooms", () => {
  it("enforces the actual migration's RLS, retries, stale source and compaction boundaries", async () => {
    await sql("")
    const result = await run("psql", ["-X","-q","-h","127.0.0.1","-p",port!,"-U",userInfo().username,"-d","postgres","-v","ON_ERROR_STOP=1","-f",resolve("supabase/tests/document-collaboration.test.sql")], {timeout:20000,maxBuffer:1024*1024})
    expect(result.stdout).toContain("checks passed")
  })
  it("enforces versioned Save/restore, actual RLS, immutable history and draft protection", async () => {
    await sql("")
    const result = await run("psql", ["-X","-q","-h","127.0.0.1","-p",port!,"-U",userInfo().username,"-d","postgres","-v","ON_ERROR_STOP=1","-f",resolve("supabase/tests/document-versions.test.sql")], {timeout:20000,maxBuffer:1024*1024})
    expect(result.stdout).toContain("document version checks passed")
  })
  it("allows exactly one of two concurrent canonical Saves without losing history", async () => {
    const owner=randomUUID(),file=randomUUID(),first=randomUUID(),second=randomUUID(),cancelId=randomUUID()
    const stamp="2026-10-14T00:00:00Z"
    const original=`${owner}/library/race.md`
    const path=(request:string)=>`${owner}/library/versions/${file}/${request}.md`
    try {
      await sql(`insert into public.profiles(id) values('${owner}'); insert into public.organizations(user_id) values('${owner}'); insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values('${owner}','active','{"plan_tier":"organization"}','sub_fixture'); insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,updated_at) values('${file}','${owner}','${original}','race.md','text/markdown',10,'${owner}','${stamp}'); insert into storage.objects(bucket_id,name,metadata) values('org-documents','${original}','{"size":10}'),('org-documents','${path(first)}','{"size":3}'),('org-documents','${path(second)}','{"size":3}'),('org-documents','${path(first).replace('.md','-previous.md')}','{"size":10}'),('org-documents','${path(second).replace('.md','-previous.md')}','{"size":10}');`)
      const room=JSON.parse(await sql(`set role service_role; select public.initialize_document_room('${file}','${owner}','source-revision','${stamp}','AQHVhqvjBQAHAQdjb250ZW50AwlwYXJhZ3JhcGgA')::text;`))
      const save=(request:string)=>sql(`set role service_role; select public.reserve_uploaded_document_version('${file}','${owner}','${request}','${room.generation}','source-revision','${stamp}',0,repeat('a',64),repeat('b',64),3); select public.commit_uploaded_document_version('${file}','${owner}','${request}','${room.generation}','source-revision','${stamp}',0,repeat('a',64),repeat('b',64),3)::text;`)
      const results=await Promise.allSettled([save(first),save(second)])
      expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1)
      expect(results.filter(result=>result.status==="rejected")).toHaveLength(1)
      expect(await sql(`select count(*) from public.document_file_versions where file_id='${file}';`)).toBe("2")
      expect(await sql(`select generation::text from public.document_collaboration_rooms where file_id='${file}';`)).toBe(room.generation)
      const current=JSON.parse(await sql(`select jsonb_build_object('revision',base_revision,'stamp',base_updated_at)::text from public.document_collaboration_rooms where file_id='${file}';`))
      await sql(`insert into storage.objects(bucket_id,name,metadata) values('org-documents','${path(cancelId)}','{"size":3}'); set role service_role; select public.reserve_uploaded_document_version('${file}','${owner}','${cancelId}','${room.generation}','${current.revision}','${current.stamp}',0,repeat('b',64),repeat('c',64),3);`)
      const race=await Promise.allSettled([
        sql(`set role service_role; select public.commit_uploaded_document_version('${file}','${owner}','${cancelId}','${room.generation}','${current.revision}','${current.stamp}',0,repeat('b',64),repeat('c',64),3);`),
        sql(`set role service_role; select public.abandon_uploaded_document_version('${file}','${owner}','${cancelId}');`),
      ])
      expect(race[1].status).toBe("fulfilled")
      const state=await sql(`select state from public.document_version_operations where file_id='${file}' and request_id='${cancelId}';`)
      expect(["committed","abandoned"]).toContain(state)
      expect(await sql(`select count(*) from public.document_file_versions where file_id='${file}' and request_id='${cancelId}';`)).toBe(state==="committed" ? "1" : "0")
      expect(race[0].status).toBe(state==="committed" ? "fulfilled" : "rejected")
    } finally {
      await sql(`delete from public.document_file_versions where file_id='${file}'; delete from public.document_collaboration_rooms where file_id='${file}'; delete from public.organization_document_files where id='${file}'; delete from storage.objects where name in ('${original}','${path(first)}','${path(second)}','${path(first).replace('.md','-previous.md')}','${path(second).replace('.md','-previous.md')}','${path(cancelId)}'); delete from public.subscriptions where user_id='${owner}'; delete from public.organizations where user_id='${owner}'; delete from public.profiles where id='${owner}';`)
    }
  },30000)
  it("serializes simultaneous initializers/writers and retains one monotonic ledger", async () => {
    const owner = randomUUID(), file = randomUUID()
    const state = new Y.Doc()
    const paragraph = new Y.XmlElement("paragraph")
    const text = new Y.XmlText("x")
    state.getXmlFragment("content").insert(0,[paragraph])
    const checkpoint = Buffer.from(Y.encodeStateAsUpdate(state)).toString("base64")
    const payloads: string[] = []
    state.on("update", update => payloads.push(Buffer.from(update).toString("base64")))
    paragraph.insert(0,[text])
    for (let i=0;i<5;i++) text.insert(0,"x")
    state.destroy()
    try {
      await sql(`insert into public.profiles(id) values('${owner}'); insert into public.organizations(user_id) values('${owner}'); insert into public.subscriptions(user_id,status,metadata,stripe_subscription_id) values('${owner}','active','{"plan_tier":"organization"}','sub_fixture'); insert into public.organization_document_files(id,org_id,storage_path,name,mime_type,size_bytes,created_by,updated_at) values('${file}','${owner}','${owner}/library/race.md','race.md','text/markdown',10,'${owner}','2026-10-14T00:00:00Z');`)
      const initialize = `set role service_role; select public.initialize_document_room('${file}','${owner}','source-revision','2026-10-14T00:00:00Z','${checkpoint}')::text;`
      const initializers = await Promise.all([sql(initialize),sql(initialize)])
      const rooms = initializers.map(result => JSON.parse(result))
      expect(rooms[0]).toEqual(rooms[1])
      const room = rooms[0]
      const writes = await Promise.all(payloads.map(payload => sql(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select public.append_document_room_update('${room.roomId}','${room.generation}','${randomUUID()}','${payload}')::text;`)))
      const sequences = writes.map(result => JSON.parse(result.split("\n").at(-1)!).sequence).sort((a,b)=>a-b)
      expect(sequences).toEqual([1,2,3,4,5,6])
      expect(await sql(`select last_sequence::text || ':' || (select count(*) from public.document_collaboration_updates where room_id=r.id)::text from public.document_collaboration_rooms r where file_id='${file}';`)).toBe("6:6")
    } finally {
      await sql(`delete from public.document_collaboration_rooms where file_id='${file}'; delete from public.organization_document_files where id='${file}'; delete from public.subscriptions where user_id='${owner}'; delete from public.organizations where user_id='${owner}'; delete from public.profiles where id='${owner}';`)
    }
  },30000)
})
