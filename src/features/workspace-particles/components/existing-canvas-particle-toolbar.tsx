"use client"

import XIcon from "lucide-react/dist/esm/icons/x"
import { NodeToolbar, Position } from "reactflow"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function ExistingCanvasParticleToolbar({
  title,
  size,
  selected,
  position,
  canEdit,
  onSizeChange,
  onRemove,
}: {
  title: string
  size: "sm" | "md" | "lg"
  selected: boolean
  position: Position
  canEdit: boolean
  onSizeChange: (size: "sm" | "md" | "lg") => void
  onRemove: () => void
}) {
  return (
    <NodeToolbar isVisible={selected} position={position} offset={12}>
      <div className="nodrag nopan bg-popover text-popover-foreground flex items-center gap-1 rounded-xl border p-1 shadow-md">
        <ToggleGroup
          type="single"
          size="sm"
          value={size}
          disabled={!canEdit}
          aria-label={`${title} display size`}
          onValueChange={(value) => {
            if (value === "sm" || value === "md" || value === "lg")
              onSizeChange(value)
          }}
        >
          <ToggleGroupItem value="sm">Small</ToggleGroupItem>
          <ToggleGroupItem value="md">Medium</ToggleGroupItem>
          <ToggleGroupItem value="lg">Large</ToggleGroupItem>
        </ToggleGroup>
        {canEdit ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${title} from canvas`}
            onClick={onRemove}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </NodeToolbar>
  )
}
