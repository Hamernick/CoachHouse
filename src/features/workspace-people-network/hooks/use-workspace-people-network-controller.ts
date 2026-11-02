"use client"

import { useEffect, useRef, useState } from "react"
import type { NetworkMove, WorkspacePeopleNetworkProps } from "../types"

export function useWorkspacePeopleNetworkController(
  props: WorkspacePeopleNetworkProps
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(320)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const lock = useRef(false)
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const resize = () =>
      setSize(
        Math.max(0, Math.min(640, element.clientWidth, element.clientHeight))
      )
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    return () => observer.disconnect()
  }, [props.loading])
  const move = async (input: NetworkMove) => {
    if (!props.canEdit || lock.current || input.from === input.to) return
    lock.current = true
    setPendingId(input.personId)
    setStatus("Saving group…")
    try {
      const result = await props.onMove(input)
      setStatus(result.ok ? "Group updated." : result.message)
    } catch {
      setStatus(
        "Could not finish the move. Check the current groups before trying again."
      )
    } finally {
      lock.current = false
      setPendingId(null)
    }
  }
  return { containerRef, size, pendingId, status, move }
}
