"use client"

import { ResearchSources } from "./research-sources"
import CheckIcon from "lucide-react/dist/esm/icons/check"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useLayoutEffect, useRef, type ReactNode } from "react"
import { Message, MessageContent } from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from "@/components/ui/message-scroller"
import type { useResearchConversation } from "./use-research-conversation"

export function ResearchConversationView({ conversation, currentId, currentPrompt, pending, panel, onOpenPlan }: {
  onOpenPlan?: (id: string) => void
  conversation: ReturnType<typeof useResearchConversation>; currentId?: string; currentPrompt: string; pending: boolean; panel: ReactNode
}) {
  const latest = conversation.turns.at(-1)
  const current = currentId ?? (pending ? undefined : latest?.id)
  const viewport = useRef<HTMLDivElement>(null)
  const scrollingHistory = useRef(false)
  const scroll = useRef<{ height: number; top: number; root: string | null } | null>(null)
  const earlier = () => {
    const node = viewport.current
    if (!scrollingHistory.current || !node || node.scrollTop > 48 || !conversation.beforeTurn || conversation.loadingEarlier || conversation.loading) return
    scrollingHistory.current = false
    scroll.current = { height: node.scrollHeight, top: node.scrollTop, root: conversation.rootId }
    void conversation.loadEarlier()
  }
  useLayoutEffect(() => {
    const saved = scroll.current, node = viewport.current
    if (saved && node && !conversation.loadingEarlier) {
      if (saved.root === conversation.rootId) node.scrollTop = saved.top + node.scrollHeight - saved.height
      scroll.current = null
    }
  }, [conversation.turns, conversation.loadingEarlier, conversation.rootId])
  return <MessageScrollerProvider autoScroll>
    <MessageScroller role="region" aria-label="Chat conversation">
      <MessageScrollerViewport ref={viewport} onScroll={earlier} onPointerDown={() => { scrollingHistory.current = true }}
        onWheel={event => { if (event.deltaY < 0) { scrollingHistory.current = true; earlier() } }}
        onKeyDown={event => { if (["Home", "PageUp", "ArrowUp"].includes(event.key)) { scrollingHistory.current = true; earlier() } }}>
        <MessageScrollerContent className="gap-5 p-3" aria-busy={conversation.loadingEarlier}>
        <div role="list" aria-label="Conversation" className="flex flex-col gap-5">
          {conversation.turns.filter(turn => !turn.unavailable).map(turn => <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor role="listitem">
            <div className="flex flex-col gap-3">
                <Message align="end"><MessageContent><Bubble variant="muted"><BubbleContent className="whitespace-pre-wrap">{turn.prompt}</BubbleContent></Bubble></MessageContent></Message>
                {turn.savedPlan && <Message><MessageContent>
                  <Tooltip><TooltipTrigger asChild>
                    <Button variant="outline" className="h-auto max-w-full justify-start rounded-xl px-3 py-2 text-left font-normal shadow-none"
                      aria-label={`Open ${turn.savedPlan.title} on board`} disabled={!onOpenPlan}
                      onClick={() => onOpenPlan?.(turn.savedPlan!.id)}>
                      <span className="min-w-0 whitespace-normal">{turn.savedPlan.title}</span><CheckIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger><TooltipContent>Added to board</TooltipContent></Tooltip>
                </MessageContent></Message>}
                {turn.id !== current && turn.summary && <Message><MessageContent><Bubble variant="ghost"><BubbleContent className="whitespace-pre-wrap">{turn.summary}</BubbleContent></Bubble>{Boolean(turn.sources?.length) && <ResearchSources sources={turn.sources!} />}</MessageContent></Message>}
            </div>
          </MessageScrollerItem>)}
        </div>
        {pending && currentPrompt && latest?.prompt !== currentPrompt && <MessageScrollerItem messageId="pending-user" scrollAnchor>
          <Message align="end"><MessageContent><Bubble variant="muted"><BubbleContent className="whitespace-pre-wrap">{currentPrompt}</BubbleContent></Bubble></MessageContent></Message>
        </MessageScrollerItem>}
        {panel && <MessageScrollerItem messageId={current ? `${current}-response` : "active-response"}><Message><MessageContent>{panel}</MessageContent></Message></MessageScrollerItem>}
      </MessageScrollerContent></MessageScrollerViewport>
      <MessageScrollerButton className="shadow-none motion-reduce:transition-none" />
    </MessageScroller>
  </MessageScrollerProvider>
}
