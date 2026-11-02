"use client"

import type { ReactNode } from "react"

import type { WorkspaceCardShortcutItemModel } from "./workspace-card-shortcut-model"
import { WorkspaceCardShortcutButton } from "./workspace-card-shortcut-button"

export function WorkspaceCardShortcutRail({
  dataAction = null,
  items,
}: {
  dataAction?: ReactNode
  items: WorkspaceCardShortcutItemModel[]
}) {
  return (
    <>
      {items.length > 0 ? (
        <div className="pointer-events-none absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 md:flex">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl canvas-glass border p-1 transition-[background-color] duration-180 ease-out md:flex-col">
            {items.map((item) => (
              <WorkspaceCardShortcutButton
                key={item.id}
                item={item}
                tooltipSide="right"
              />
            ))}
          </div>
        </div>
      ) : null}
      {dataAction}
    </>
  )
}
