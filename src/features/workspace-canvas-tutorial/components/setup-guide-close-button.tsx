import XIcon from "lucide-react/dist/esm/icons/x"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SetupGuideCloseButton({ onClose, overImage = false, label = "Pause walkthrough", className }: {
  onClose: () => void
  overImage?: boolean
  label?: string
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClose}
      className={cn(
        "group size-11 shrink-0 touch-manipulation rounded-full bg-transparent shadow-none hover:bg-transparent dark:hover:bg-transparent",
        className,
      )}
    >
      <span aria-hidden="true" className={cn(
        "flex size-8 items-center justify-center rounded-full transition-colors",
        overImage
          ? "bg-slate-950/30 text-white group-hover:bg-slate-950/40"
          : "bg-foreground/5 text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground",
      )}>
        <XIcon className="size-4" />
      </span>
    </Button>
  )
}
