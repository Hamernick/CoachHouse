import BadgeCheckIcon from "lucide-react/dist/esm/icons/badge-check"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatEin } from "@/lib/organization/ein"

export function PublicProfileEin({ value, formationStatus }: { value: unknown; formationStatus?: unknown }) {
  const ein = formatEin(value)
  if (!ein) return null
  return (
    <p className="text-muted-foreground mt-2 text-sm tabular-nums">
      <span className="inline-flex items-center gap-1.5 align-middle">
        {formationStatus === "approved" ? <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              aria-label="Verified"
              tabIndex={0}
              className="focus-ring inline-flex shrink-0 rounded-sm text-blue-600 outline-none dark:text-blue-400"
            >
              <BadgeCheckIcon className="size-4" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Verified: 501(c)(3) status and EIN on file</TooltipContent>
        </Tooltip> : null}
        <span>EIN {ein}</span>
      </span>
    </p>
  )
}
