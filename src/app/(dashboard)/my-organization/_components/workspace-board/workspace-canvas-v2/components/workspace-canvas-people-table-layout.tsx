import type { CSSProperties, ReactNode } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"

export function WorkspacePeopleTableLayout({
  children,
  columnSizeVars,
}: {
  children: ReactNode
  columnSizeVars: CSSProperties
}) {
  return (
    <div
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
      style={columnSizeVars}
    >
      <ScrollArea
        className="min-h-0 w-full max-w-full min-w-0 flex-1 overflow-hidden"
        viewportClassName="h-full max-w-full overscroll-contain touch-pan-x touch-pan-y [&>div]:!h-full [&>div]:!block [&>div]:!w-full [&>div]:!max-w-full [&>div]:!min-w-0"
        contentClassName="flex h-full min-h-0 max-w-full flex-col [&>*]:min-w-0"
      >
        {children}
      </ScrollArea>
    </div>
  )
}
