"use client"

import { useSyncExternalStore } from "react"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WORKSPACE_TEXT_STYLES } from "@/components/workspace/workspace-typography"
import type { CompanionSession } from "../hooks/use-companion-session"

const subscribe = () => () => {}
function ReceiptTime({ at }: { at: string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  return <time className={WORKSPACE_TEXT_STYLES.utility} dateTime={at}>{hydrated ? new Date(at).toLocaleString() : at}</time>
}

export function CompanionReceipt({ session }: { session: CompanionSession }) {
  const { snapshot } = session
  return <div className="flex flex-col gap-3">
    <dl className="flex flex-col gap-2 text-[13px]">
      <div className="flex justify-between gap-3"><dt>Answers</dt><dd>Revision {snapshot.draft.revision}</dd></div>
      <div className="flex justify-between gap-3"><dt>Document</dt><dd>Revision {snapshot.document.revision}</dd></div>
      <div className="flex justify-between gap-3"><dt>Assignment</dt><dd>{snapshot.submission.status === "submitted" ? "Submitted" : "Not submitted"}</dd></div>
      <div className="flex justify-between gap-3"><dt>Lesson</dt><dd>{snapshot.submission.completed ? "Completed in sandbox" : "Not completed"}</dd></div>
    </dl>
    {snapshot.receipts.length > 0 && <div className="flex flex-col gap-1"><p className={WORKSPACE_TEXT_STYLES.bodyMuted}>{snapshot.receipts.at(-1)?.message}</p><ReceiptTime at={snapshot.receipts.at(-1)!.at} /></div>}
    <div><Button size="sm" variant="ghost" disabled={Boolean(session.pending)} onClick={() => void session.refresh()}><RefreshCwIcon data-icon="inline-start" />Refresh saved state</Button></div>
  </div>
}
