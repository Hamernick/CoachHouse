"use client"

import type { ComponentProps, ReactNode } from "react"
import GripIcon from "lucide-react/dist/esm/icons/grip-vertical"
import { cn } from "@/lib/utils"
import { useParticleLibraryDragSource } from "../hooks/use-particle-library-drag-source"
import type { ParticleLibraryDragItem } from "./particle-library-drag-context"

export function ParticleLibraryDragSource({
  children,
  getItem,
  disabled,
  className,
  getPlacement,
  touchHandleClassName,
  ...ownerProps
}: {
  children: ReactNode
  getItem: () => ParticleLibraryDragItem
  disabled: boolean
  className?: string
  getPlacement?: () => ParticleLibraryDragItem["onPlacement"]
  touchHandleClassName?: string
} & Omit<
  ComponentProps<"div">,
  "children" | "onPointerDown" | "onClickCapture" | "onDragStart" | "draggable"
>) {
  const gesture = useParticleLibraryDragSource(() => {
    const item = getItem()
    return getPlacement ? { ...item, onPlacement: getPlacement() } : item
  }, disabled)
  return (
    <div
      {...ownerProps}
      className={className}
      draggable={false}
      data-draggable={!disabled}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={gesture.onPointerDown}
      onClickCapture={gesture.onClickCapture}
    >
      {children}
      {gesture.available && !disabled && (
        <span
          data-particle-touch-drag="true"
          aria-hidden
          title="Drag to canvas"
          className={cn("text-muted-foreground absolute bottom-0 left-0 hidden size-11 touch-none items-center justify-center rounded-full [@media(pointer:coarse)]:flex", touchHandleClassName)}
        >
          <GripIcon className="pointer-events-none size-4" />
        </span>
      )}
    </div>
  )
}
