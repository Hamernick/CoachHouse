import { afterEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import { roomSchema, decodeRoomBinary, encodeRoomUpdate, ROOM_TAIL_PAGE, type DocumentRoomReceipt } from "@/features/document-editing/lib/room-contracts"
import { readDocumentRoom, readDocumentRoomTail, appendDocumentRoomUpdate, documentRoomError } from "@/features/document-editing/lib/room-client"
import { createDocumentRoomWriter } from "@/features/document-editing/lib/room-writer"
import { createDocumentReplica } from "@/features/document-editing/lib/document-replica"
import { createRecoverableDocumentRoomWriter } from "@/features/document-editing/lib/recoverable-room-writer"

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12,"0")}`
const source = { provider: "coach_house" as const, organizationId: id(1), fileId: id(2) }
const seed = new Y.Doc()
seed.getText("content").insert(0,"Seed")
const initial = Y.encodeStateAsUpdate(seed)
seed.destroy()
const hex = (bytes: Uint8Array) => "\\x" + Buffer.from(bytes).toString("hex")
const room = { id: id(3), org_id: id(1), file_id: id(2), generation: id(4), base_revision: "original", base_updated_at: "2026-10-14T00:00:00Z", checkpoint: hex(initial), checkpoint_sequence: 0, last_sequence: 0, canonical_sequence: 0, recovery_bytes: 0 }
const receipt = (batchId: string): DocumentRoomReceipt => ({ batchId, generation: room.generation, sequence: 1 })
function clientFixture(data: unknown, error: { code: string } | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown; error: { code: string } | null }) => unknown) => Promise.resolve({data,error}).then(resolve),
  }
  const from = vi.fn(() => query), rpc = vi.fn(() => query)
  return { client: { from, rpc } as unknown as SupabaseClient<Database>, from, rpc, query }
}
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe("document room identity and binary contracts", () => {
  it("validates binary updates and preserves complete bytes", () => {
    expect(decodeRoomBinary(hex(initial))).toEqual(initial)
    expect(new Uint8Array(Buffer.from(encodeRoomUpdate(initial),"base64"))).toEqual(initial)
    expect(() => decodeRoomBinary("\\xff")).toThrow("invalid")
    expect(() => decodeRoomBinary("abc")).toThrow()
    expect(() => encodeRoomUpdate(new Uint8Array(131073))).toThrow("budget")
    expect(roomSchema.safeParse({...room, checkpoint_sequence: 10}).success).toBe(false)
    expect(roomSchema.safeParse({...room, canonical_sequence: 1}).success).toBe(false)
  })
  it("reads exactly the canonical organization/file, never a broad workspace list", async () => {
    const fixture = clientFixture(room)
    expect(await readDocumentRoom(fixture.client, source)).toEqual(room)
    expect(fixture.query.eq).toHaveBeenCalledWith("org_id",source.organizationId)
    expect(fixture.query.eq).toHaveBeenCalledWith("file_id",source.fileId)
    await expect(readDocumentRoom(clientFixture({...room,file_id:id(9)}).client,source)).rejects.toThrow("another document")
    await expect(readDocumentRoom(fixture.client,{...source,fileId:"bad-id"})).rejects.toThrow()
    expect(fixture.from).toHaveBeenCalledOnce()
  })
  it("does no tail request when already caught up", async () => {
    const fixture = clientFixture([])
    expect(await readDocumentRoomTail(fixture.client,room,0)).toEqual([])
    expect(fixture.from).not.toHaveBeenCalled()
  })
  it("reads a bounded, contiguous tail for one room/generation", async () => {
    const update = { room_id:room.id,generation:room.generation,sequence:1,batch_id:id(5),actor_id:id(6),payload:hex(initial) }
    const fixture = clientFixture([update])
    expect(await readDocumentRoomTail(fixture.client,{...room,last_sequence:1},0)).toEqual([update])
    expect(fixture.query.limit).toHaveBeenCalledWith(ROOM_TAIL_PAGE)
    expect(fixture.query.eq).toHaveBeenCalledWith("room_id",room.id)
    expect(fixture.query.eq).toHaveBeenCalledWith("generation",room.generation)
    await expect(readDocumentRoomTail(clientFixture([{...update,sequence:2}]).client,{...room,last_sequence:2},0)).rejects.toThrow("tail changed")
    await expect(readDocumentRoomTail(clientFixture([{...update,generation:id(9)}]).client,{...room,last_sequence:1},0)).rejects.toThrow("tail changed")
    await expect(readDocumentRoomTail(clientFixture([]).client,{...room,last_sequence:1},0)).rejects.toThrow("compacted")
  })
  it("uses only durable, matching receipts and never supplies a user ID", async () => {
    const batch = { id:id(5),update:initial }
    const fixture = clientFixture(receipt(batch.id))
    expect(await appendDocumentRoomUpdate(fixture.client,room,batch)).toEqual(receipt(batch.id))
    expect(fixture.rpc).toHaveBeenCalledWith("append_document_room_update", {
      p_room_id:room.id,p_generation:room.generation,p_batch_id:batch.id,p_update_base64:encodeRoomUpdate(initial),
    })
    await expect(appendDocumentRoomUpdate(clientFixture(receipt(id(9))).client,room,batch)).rejects.toThrow("another document session")
    await expect(appendDocumentRoomUpdate(clientFixture(null,{code:"42501"}).client,room,batch)).rejects.toMatchObject({code:"access"})
    const invalid = clientFixture(null)
    await expect(appendDocumentRoomUpdate(invalid.client,room,{...batch,update:new Uint8Array([255])})).rejects.toThrow("invalid")
    expect(invalid.rpc).not.toHaveBeenCalled()
  })
  it.each([ ["42501","access"], ["40001","conflict"], ["54000","capacity"], ["22023","invalid"], ["PGRST202","unavailable"] ])("maps %s to a recoverable %s state", (code,result) => {
    expect(documentRoomError({code}).code).toBe(result)
  })
})

function writerFixture(commitOverride?: (batch: { id:string;update:Uint8Array }) => Promise<DocumentRoomReceipt>) {
  const replica = createDocumentReplica(initial)
  const onState = vi.fn()
  const commit = vi.fn(commitOverride ?? (async (batch) => receipt(batch.id)))
  const writer = createDocumentRoomWriter({replica,room,commit,onState})
  return {replica,onState,commit,writer,edit:() => replica.document.getText("content").insert(0,"x")}
}
function cleanup(fixture: ReturnType<typeof writerFixture>) {
  fixture.writer.dispose()
  const pending = fixture.replica.prepare()
  if (pending) fixture.replica.acknowledge(pending.id)
  fixture.replica.dispose()
}
describe("bounded durable draft writes", () => {
  it("awaits local recovery before the server RPC and sends nothing on recovery failure", async () => {
    const replica = createDocumentReplica(initial)
    replica.document.getText("content").insert(0,"recover me")
    let finish!: () => void
    const flush = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const fixture = clientFixture(null)
    fixture.query.then = resolve => Promise.resolve({ data: receipt(replica.prepare()!.id), error: null }).then(resolve)
    const writer = createRecoverableDocumentRoomWriter({client:fixture.client,room,replica,recovery:{flush},onState:vi.fn()})
    const flight = writer.flush()
    await Promise.resolve(); expect(fixture.rpc).not.toHaveBeenCalled()
    finish(); await flight
    expect(fixture.rpc).toHaveBeenCalledOnce();expect(replica.pendingBytes).toBe(0)
    writer.dispose();replica.dispose()

    const pending = createDocumentReplica(initial)
    pending.document.getText("content").insert(0,"keep me")
    const blocked = clientFixture(null),onState=vi.fn()
    const failed = createRecoverableDocumentRoomWriter({client:blocked.client,room,replica:pending,recovery:{flush:vi.fn().mockRejectedValue(new Error("quota"))},onState})
    await failed.flush();expect(blocked.rpc).not.toHaveBeenCalled();expect(pending.pendingBytes).toBeGreaterThan(0)
    expect(onState).toHaveBeenLastCalledWith("blocked",expect.any(Error))
    failed.dispose();pending.acknowledge(pending.prepare()!.id);pending.dispose()
  })
  it("coalesces 60 edits and status notifications into one write", async () => {
    vi.useFakeTimers()
    const fixture = writerFixture()
    for (let i=0;i<60;i++) fixture.edit()
    expect(fixture.commit).not.toHaveBeenCalled()
    expect(fixture.onState.mock.calls.filter(([state])=>state==="pending")).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(750)
    expect(fixture.commit).toHaveBeenCalledOnce()
    expect(fixture.replica.pendingBytes).toBe(0)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fixture.commit).toHaveBeenCalledOnce()
    cleanup(fixture)
  })
  it("does not starve durable updates during continuous typing", async () => {
    vi.useFakeTimers()
    const fixture = writerFixture()
    for (let i=0;i<60;i++) { fixture.edit(); await vi.advanceTimersByTimeAsync(100) }
    expect(fixture.commit.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(fixture.commit.mock.calls.length).toBeLessThanOrEqual(4)
    await fixture.writer.flush()
    expect(fixture.replica.pendingBytes).toBe(0)
    cleanup(fixture)
  })
  it("allows one in-flight write and retains edits arriving during it", async () => {
    vi.useFakeTimers()
    const resolvers: Array<(receipt:DocumentRoomReceipt)=>void> = []
    const fixture = writerFixture(() => new Promise(resolve => resolvers.push(resolve)))
    fixture.edit(); await vi.advanceTimersByTimeAsync(750)
    fixture.edit(); await vi.advanceTimersByTimeAsync(3000)
    expect(fixture.commit).toHaveBeenCalledOnce()
    resolvers.shift()?.(receipt(fixture.commit.mock.calls[0][0].id))
    await vi.advanceTimersByTimeAsync(750)
    expect(fixture.commit).toHaveBeenCalledTimes(2)
    resolvers.shift()?.(receipt(fixture.commit.mock.calls[1][0].id))
    await vi.advanceTimersByTimeAsync(0)
    expect(fixture.replica.pendingBytes).toBe(0)
    cleanup(fixture)
  })
  it("blocks after failure without an idle retry loop and retries the same batch", async () => {
    vi.useFakeTimers()
    const fixture = writerFixture()
    fixture.commit.mockRejectedValueOnce(new Error("connection lost"))
    fixture.edit(); await vi.advanceTimersByTimeAsync(750)
    const original = fixture.commit.mock.calls[0][0]
    await vi.advanceTimersByTimeAsync(60000)
    expect(fixture.commit).toHaveBeenCalledOnce()
    expect(fixture.replica.pendingBytes).toBeGreaterThan(0)
    await fixture.writer.retry()
    expect(fixture.commit.mock.calls[1][0]).toEqual(original)
    expect(fixture.replica.pendingBytes).toBe(0)
    cleanup(fixture)
  })
  it("pauses hidden views, keeps their outbox and does not echo remote updates", async () => {
    vi.useFakeTimers()
    const fixture = writerFixture()
    fixture.edit(); fixture.writer.setActive(false)
    await vi.advanceTimersByTimeAsync(60000)
    expect(fixture.commit).not.toHaveBeenCalled()
    fixture.writer.setActive(true); await vi.advanceTimersByTimeAsync(750)
    expect(fixture.commit).toHaveBeenCalledOnce()
    const remote = new Y.Doc(); remote.getText("remote").insert(0,"remote")
    fixture.replica.receive(Y.encodeStateAsUpdate(remote)); remote.destroy()
    await vi.advanceTimersByTimeAsync(60000)
    expect(fixture.commit).toHaveBeenCalledOnce()
    cleanup(fixture)
  })
  it("retains pending bytes for an incorrect receipt and after scheduler disposal", async () => {
    const fixture = writerFixture(async () => receipt(id(99)))
    fixture.edit(); await fixture.writer.flush()
    expect(fixture.replica.pendingBytes).toBeGreaterThan(0)
    fixture.writer.dispose()
    expect(fixture.replica.pendingBytes).toBeGreaterThan(0)
    cleanup(fixture)
  })
})
