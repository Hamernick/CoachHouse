import Link from "next/link"
import type { ReactNode } from "react"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"

import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"

export function HomeMediaPlaceholder({ ratio = 16 / 9 }: { ratio?: number }) {
  return (
    <div aria-hidden="true" data-home-media-placeholder="" className="w-full overflow-hidden rounded-3xl bg-muted sm:rounded-[40px]">
      <AspectRatio ratio={ratio} />
    </div>
  )
}

export function HomeStoryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="ghost" className="h-auto min-h-11 justify-start self-start rounded-full pr-3 pl-4 text-sm text-primary whitespace-normal shadow-none has-[>svg]:pl-4">
      <Link href={href}>
        {children}
        <ArrowUpRightIcon data-icon="inline-end" aria-hidden />
      </Link>
    </Button>
  )
}
