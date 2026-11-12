"use client"

import { useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai"
import { createResearchProgressReceiver, type ResearchProgress } from "../lib/research-progress"
import type { ResearchRequest } from "../research-types"

type Reply = { run?: unknown; error?: string; failure?: { code?: unknown }; reserved?: boolean }
type ChatMessage = UIMessage<unknown, { research: ResearchProgress; reply: Reply }>
type Active = { controller: AbortController; receive: ReturnType<typeof createResearchProgressReceiver>; reply?: Reply;
  snapshot?: Extract<ResearchProgress, { kind: "run.snapshot" }>; terminal: boolean; failed: boolean;
  event: (event: ResearchProgress) => void; touch: () => void }

export function useResearchChatStream(userId: string) {
  const active = useRef<Active | null>(null)
  const [transport] = useState(() => new DefaultChatTransport<ChatMessage>({
    api: "/api/workspace-ai/research", headers: { "x-coach-house-chat": "1" },
    prepareSendMessagesRequest: ({ body }) => { if (!body) throw new Error("Chat request unavailable"); return { body } },
    fetch: async (url, init) => {
      const run = active.current
      if (!run) throw new Error("Chat request unavailable")
      const signal = init?.signal ? AbortSignal.any([init.signal, run.controller.signal]) : run.controller.signal
      const response = await fetch(url, { ...init, signal })
      if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
        // JSON is the existing recovery/replay and disabled-stream response.
        const reply = await response.json() as Reply
        return createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({ writer }) => {
          writer.write({ type: "start" }); writer.write({ type: "data-reply", data: reply, transient: true }); writer.write({ type: "finish" })
        } }) })
      }
      let bytes = 0
      return new Response(response.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
        bytes += chunk.byteLength
        if (bytes > 65536) throw new Error("Chat stream exceeds its limit")
        controller.enqueue(chunk)
      } }), { signal }), { status: response.status, headers: response.headers })
    },
  }))
  const chat = useChat<ChatMessage>({ transport,
    onData: part => {
      const run = active.current
      if (!run || run.controller.signal.aborted) return
      if (part.type === "data-reply") { run.reply = part.data; run.touch(); return }
      if (part.type !== "data-research") return
      const event = run.receive(part.data)
      if (!event) return
      run.touch(); run.event(event)
      if (event.kind === "run.snapshot") run.snapshot = event
      if (event.kind === "run.terminal") run.terminal = true
    },
    onError: () => { if (active.current) active.current.failed = true },
  })
  return async (request: ResearchRequest, signal: AbortSignal, onEvent: Active["event"]): Promise<Reply | null> => {
    if (active.current) throw new Error("A chat request is already running")
    const controller = new AbortController()
    let idle: ReturnType<typeof setTimeout>
    const stop = () => { controller.abort(); void chat.stop() }
    const touch = () => { clearTimeout(idle); idle = setTimeout(stop, 30_000) }
    const run: Active = { controller, receive: createResearchProgressReceiver({ runId: request.id, target: request.target, userId }, "chat"), terminal: false, failed: false, event: onEvent, touch }
    active.current = run
    const maximum = setTimeout(stop, 120_000)
    signal.addEventListener("abort", stop, { once: true })
    try {
      if (signal.aborted) return null
      touch(); chat.setMessages([])
      await chat.sendMessage({ text: request.prompt }, { body: request })
      if (run.failed || controller.signal.aborted || signal.aborted) return null
      return run.reply ?? (run.terminal && run.snapshot ? { run: run.snapshot.payload.run } : null)
    } finally {
      clearTimeout(idle!); clearTimeout(maximum); signal.removeEventListener("abort", stop)
      controller.abort(); active.current = null
    }
  }
}
