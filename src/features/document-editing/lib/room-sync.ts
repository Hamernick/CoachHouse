import type { createDocumentReplica } from "./document-replica"
import { createDocumentReplica as createReplica } from "./document-replica"
import { decodeRoomBinary, roomSchema, roomUpdateSchema, type DocumentRoom, type DocumentRoomUpdate } from "./room-contracts"
import { DocumentRoomError } from "./room-client"
import { validateCanonicalAdvance, type DocumentCanonicalReceipt } from "./canonical-advance"
import type { DocumentRecoveryState } from "./document-recovery"

export type RoomSyncState = {
  status: "loading" | "ready" | "offline" | "blocked" | "paused"
  sequence: number
  editable: boolean
  error?: unknown
}
export interface DocumentRoomTransport {
  subscribe(handlers: {
    update: (value: unknown) => void
    connected: () => void
    offline: () => void
    locked: () => void
    changed?: () => void
  }): () => void
  read(): Promise<{ room: DocumentRoom; editable: boolean; canonical?: DocumentCanonicalReceipt }>
  tail(room: DocumentRoom, after: number): Promise<DocumentRoomUpdate[]>
}

/** Subscribe first, then read a fixed durable prefix. Reconnect merges into the
 * same replica, preserving local edits. No interval, broadcast ack or reseed. */
export function createDocumentRoomSync({ expected, transport, recovery, onState }: {
  expected: DocumentRoom
  transport: DocumentRoomTransport
  recovery?: DocumentRecoveryState
  onState: (state: RoomSyncState) => void
}) {
  roomSchema.parse(expected)
  let room = expected
  let replica: ReturnType<typeof createDocumentReplica> | null = null
  let sequence = 0
  let connected = false
  let locked = false
  let blocked = false
  let epoch = 0
  let stop: (() => void) | null = null
  let flight: Promise<void> | null = null
  let requested = false
  let reportedRevision=expected.base_revision
  let reportedCanonical=expected.canonical_sequence
  let state: RoomSyncState = { status: "paused", sequence, editable: false }
  const buffered = new Map<number, DocumentRoomUpdate>()
  let bufferedBytes = 0
  function report(status: RoomSyncState["status"], editable = false, error?: unknown) {
    if (status === state.status && sequence === state.sequence && editable === state.editable && error === state.error && reportedRevision===room.base_revision && reportedCanonical===room.canonical_sequence) return
    reportedRevision=room.base_revision;reportedCanonical=room.canonical_sequence
    state = { status, sequence, editable, ...(error ? { error } : {}) }
    onState(state)
  }
  function fail(error: unknown) {
    blocked = true
    pause()
    report("blocked", false, error)
  }
  function remove(value: DocumentRoomUpdate) {
    if (buffered.delete(value.sequence)) bufferedBytes -= (value.payload.length - 2) / 2
  }
  function drain() {
    for (const value of buffered.values()) if (value.sequence <= sequence) remove(value)
    let next = buffered.get(sequence + 1)
    while (next && replica) {
      replica.receive(decodeRoomBinary(next.payload))
      sequence = next.sequence
      remove(next)
      next = buffered.get(sequence + 1)
    }
    room = { ...room, last_sequence: Math.max(room.last_sequence, sequence) }
  }
  function receive(value: unknown) {
    if (locked || blocked || !stop) return
    try {
      const update = roomUpdateSchema.parse(value)
      if (update.room_id !== expected.id || update.generation !== expected.generation)
        throw new DocumentRoomError("conflict", "This update belongs to another document session.")
      if (replica && update.sequence <= sequence) return
      decodeRoomBinary(update.payload)
      const previous = buffered.get(update.sequence)
      if (previous) {
        if (previous.batch_id !== update.batch_id || previous.payload !== update.payload)
          throw new DocumentRoomError("conflict", "Conflicting shared update receipts. Keep your pending edits.")
        return
      }
      bufferedBytes += (update.payload.length - 2) / 2
      if (buffered.size >= 512 || bufferedBytes > 8 * 1024 * 1024) {
        buffered.clear(); bufferedBytes = 0
        // Durable rows remain authoritative; recover from a bounded snapshot.
        request()
        return
      }
      buffered.set(update.sequence, update)
      if (state.status === "ready" && !flight) {
        drain()
        if (!buffered.size) report("ready", state.editable)
        else request()
      }
    } catch (error) { fail(error) }
  }
  async function reconcile(ticket: number) {
    const snapshot = await transport.read()
    if (ticket !== epoch || !connected || locked) return
    const current = roomSchema.parse(snapshot.room)
    validateCanonicalAdvance(room,current,snapshot.canonical)
    if (replica && sequence > current.last_sequence)
      throw new DocumentRoomError("conflict", "The shared document sequence moved backwards.")
    const checkpoint = decodeRoomBinary(current.checkpoint)
    if (!replica) {
      replica = createReplica(checkpoint, recovery)
      sequence = current.checkpoint_sequence
    } else {
      replica.receive(checkpoint)
      sequence = Math.max(sequence, current.checkpoint_sequence)
    }
    while (sequence < current.last_sequence) {
      const page = await transport.tail(current, sequence)
      if (ticket !== epoch || !connected || locked) return
      if (!page.length) throw new DocumentRoomError("conflict", "The recovery tail changed while loading.")
      for (const value of page) {
        const update = roomUpdateSchema.parse(value)
        if (update.room_id !== current.id || update.generation !== current.generation || update.sequence !== sequence + 1 || update.sequence > current.last_sequence)
          throw new DocumentRoomError("conflict", "The recovery tail is not contiguous.")
        replica.receive(decodeRoomBinary(update.payload))
        sequence = update.sequence
      }
    }
    room = current
    drain()
    if (buffered.size) report("offline", false, new DocumentRoomError("unavailable", "Some shared edits are missing. Reconnect to recover them."))
    else report("ready", snapshot.editable)
  }
  function request(showLoading=true) {
    if (!connected || locked || blocked) return
    requested = true
    if (flight) return
    const ticket = epoch
    if(showLoading)report("loading")
    flight = (async () => {
      // One bounded fresh-checkpoint retry handles compaction during a tail read.
      let retries = 0
      while (requested && ticket === epoch && connected && !locked && !blocked) {
        requested = false
        try { await reconcile(ticket) }
        catch (error) {
          if (ticket !== epoch || !connected || locked) return
          if (error instanceof DocumentRoomError && error.code === "conflict" && retries++ === 0) requested = true
          else if (error instanceof DocumentRoomError && error.code === "unavailable") report("offline", false, error)
          else fail(error)
        }
      }
    })().finally(() => {
      flight = null
      if (requested && connected && !locked && !blocked) request()
    })
  }
  function pause() {
    epoch++; connected = false; requested = false
    const unsubscribe = stop; stop = null
    unsubscribe?.()
    buffered.clear(); bufferedBytes = 0
    report(locked || blocked ? "blocked" : "paused")
  }
  return {
    get replica() { return replica },
    get room() { return room },
    get state() { return state },
    async refresh() {
      if(!connected || locked || blocked) throw new DocumentRoomError("unavailable","Reconnect before saving this document.")
      request(false)
      await flight
      if(state.status!=="ready") throw state.error ?? new DocumentRoomError("unavailable","Shared state could not be refreshed.")
      return room
    },
    resume() {
      if (locked || stop) return
      blocked = false
      const ticket = ++epoch
      // Set before subscribe: a synchronous transport callback can buffer safely.
      stop = () => {}
      report("loading")
      const unsubscribe = transport.subscribe({
        update: value => { if (ticket === epoch) receive(value) },
        changed: () => { if(ticket===epoch)request(false) },
        connected: () => { if (ticket === epoch) { connected = true; request() } },
        offline: () => { if (ticket === epoch) { connected = false; report("offline") } },
        locked: () => {
          if (ticket !== epoch) return
          locked = true; pause()
          report("blocked", false, new DocumentRoomError("access", "The signed-in account changed. Your pending edits are locked to their original account."))
        },
      })
      if (ticket !== epoch) unsubscribe()
      else stop = unsubscribe
    },
    pause,
    retry() {
      if (locked) return
      blocked = false
      if (connected) request()
      else { pause(); this.resume() }
    },
    // Pending edits belong to the owner; unsubscribe never destroys the replica.
    dispose: pause,
  }
}
