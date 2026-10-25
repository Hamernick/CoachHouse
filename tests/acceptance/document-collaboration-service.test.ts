import { beforeEach, describe, expect, it, vi } from "vitest"
import * as Y from "yjs"
import { openDocumentRoom, compactDocumentRoom } from "@/features/document-editing/server/room-service"

const mocks = vi.hoisted(()=>({ actor:vi.fn(),room:vi.fn(),tail:vi.fn(),read:vi.fn(),admin:vi.fn(),rpc:vi.fn() }))
vi.mock("@/features/document-editing/server/room-access",()=>({ requireDocumentRoomActor:mocks.actor }))
vi.mock("@/features/document-editing/server/read-local-document",()=>({ readLocalDocument:mocks.read }))
vi.mock("@/lib/supabase/admin",()=>({ createSupabaseAdminClient:mocks.admin }))
vi.mock("@/features/document-editing/lib/room-client",async()=>({ ...await vi.importActual<typeof import("@/features/document-editing/lib/room-client")>("@/features/document-editing/lib/room-client"), readDocumentRoom:mocks.room,readDocumentRoomTail:mocks.tail }))
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`
const source={provider:"coach_house" as const,organizationId:id(1),fileId:id(2)}
const stamp="2026-10-14T00:00:00Z"
const seed=new Y.Doc(); seed.getText("test").insert(0,"Original")
const checkpoint="\\x"+Buffer.from(Y.encodeStateAsUpdate(seed)).toString("hex"); seed.destroy()
const room={id:id(3),org_id:id(1),file_id:id(2),generation:id(4),base_revision:"original",base_updated_at:stamp,checkpoint,checkpoint_sequence:0,last_sequence:0,canonical_sequence:0,recovery_bytes:0}
beforeEach(()=>{
  vi.clearAllMocks()
  mocks.actor.mockResolvedValue({source,userId:id(1),supabase:{},editable:true,file:{updated_at:stamp}})
  mocks.room.mockResolvedValue(room)
  mocks.read.mockResolvedValue({source,updatedAt:stamp,revision:"original",content:"# Full document"})
  mocks.admin.mockReturnValue({rpc:mocks.rpc})
  mocks.rpc.mockResolvedValue({data:{roomId:room.id,generation:room.generation},error:null})
  mocks.tail.mockResolvedValue([])
})
describe("authorized room bootstrap and compaction",()=>{
  it("does not redownload or reseed an existing room",async()=>{
    expect(await openDocumentRoom(source)).toEqual({room,editable:true})
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("never bootstraps for a readonly viewer",async()=>{
    mocks.actor.mockResolvedValue({source,userId:id(5),supabase:{},editable:false,file:{updated_at:stamp}})
    mocks.room.mockResolvedValue(null)
    expect(await openDocumentRoom(source)).toEqual({room:null,editable:false})
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("seeds once through server-only RPC with the verified actor and source timestamp",async()=>{
    mocks.room.mockResolvedValueOnce(null).mockResolvedValueOnce(room)
    expect(await openDocumentRoom(source)).toEqual({room,editable:true})
    expect(mocks.read).toHaveBeenCalledOnce()
    expect(mocks.admin).toHaveBeenCalledWith({actorId:id(1)})
    const [name,args]=mocks.rpc.mock.calls[0]
    expect(name).toBe("initialize_document_room")
    expect(args).toMatchObject({p_actor_id:id(1),p_file_id:id(2),p_base_revision:"original",p_expected_updated_at:stamp})
    const decoded=new Y.Doc()
    Y.applyUpdate(decoded,new Uint8Array(Buffer.from(args.p_checkpoint_base64,"base64")))
    expect(decoded.getXmlFragment("content").toString()).toContain("Full document")
    decoded.destroy()
  })
  it("rejects stale sources without replacing shared edits",async()=>{
    mocks.room.mockResolvedValue({...room,base_updated_at:"2026-10-13T00:00:00Z"})
    await expect(openDocumentRoom(source)).rejects.toMatchObject({code:"conflict"})
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("does not initialize unsupported/lossy Markdown",async()=>{
    mocks.room.mockResolvedValue(null)
    mocks.read.mockResolvedValue({source,updatedAt:stamp,revision:"original",content:"<script>bad()</script>"})
    await expect(openDocumentRoom(source)).rejects.toThrow("original is unchanged")
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("fails closed if current access cannot read the newly created room",async()=>{
    mocks.room.mockResolvedValue(null)
    await expect(openDocumentRoom(source)).rejects.toMatchObject({code:"access"})
  })
  it("refuses compaction from viewers or changed sources",async()=>{
    mocks.actor.mockResolvedValueOnce({source,editable:false})
    await expect(compactDocumentRoom(source)).rejects.toMatchObject({code:"access"})
    mocks.room.mockResolvedValue({...room,base_updated_at:"2026-10-13T00:00:00Z"})
    await expect(compactDocumentRoom(source)).rejects.toMatchObject({code:"conflict"})
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("uses a verified checkpoint and sequence CAS without provider Save",async()=>{
    mocks.rpc.mockResolvedValue({data:false,error:null})
    expect(await compactDocumentRoom(source)).toEqual({compacted:false})
    expect(mocks.rpc).toHaveBeenCalledWith("compact_document_room",expect.objectContaining({p_room_id:room.id,p_generation:room.generation,p_expected_sequence:0}))
    expect(mocks.read).not.toHaveBeenCalled()
    const snapshot=new Y.Doc()
    Y.applyUpdate(snapshot,new Uint8Array(Buffer.from(mocks.rpc.mock.calls[0][1].p_checkpoint_base64,"base64")))
    expect(snapshot.getText("test").toString()).toBe("Original"); snapshot.destroy()
  })
})
