import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern/index"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { WORKSPACE_PARTICLE_CHROME } from "@/components/workspace/workspace-particle-chrome"

export type ProgramCardProps = {
  title: string
  org?: string
  location?: string
  description?: string
  bannerImageUrl?: string
  imageUrl?: string
  statusLabel?: string
  showStatusBadge?: boolean
  chips?: string[]
  goalCents?: number
  raisedCents?: number
  asOf?: string
  ctaLabel?: string
  ctaHref?: string
  ctaTarget?: string
  onCtaClick?: () => void
  patternId?: string
  variant?: "list" | "medium" | "full"
  contentFill?: boolean
  surface?: "default" | "workspace"
  className?: string
}

export function ProgramCard({
  title,
  org,
  location,
  description,
  bannerImageUrl = "",
  imageUrl = "",
  statusLabel = "In progress",
  showStatusBadge = true,
  chips = [],
  goalCents = 0,
  raisedCents = 0,
  asOf,
  ctaLabel = "Action",
  ctaHref,
  ctaTarget = "_blank",
  onCtaClick,
  patternId,
  variant = "medium",
  contentFill = true,
  surface = "default",
  className,
}: ProgramCardProps) {
  const heroImageUrl = bannerImageUrl || imageUrl
  const thumbImageUrl = imageUrl || bannerImageUrl
  const goal = goalCents || 0
  const raised = raisedCents || 0
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
  const asOfText = asOf

  const money = (cents: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Math.max(0, Math.round(cents / 100)))

  const headerSquares: Array<[number, number]> = [
    [4, 4],
    [5, 1],
    [8, 2],
    [5, 3],
    [5, 5],
    [10, 10],
    [12, 15],
    [15, 10],
    [10, 15],
    [15, 10],
    [10, 15],
    [15, 10],
  ]

  const visibleChips = chips.slice(0, 3)
  const compact = surface === "workspace"
  const extraChipCount = Math.max(0, chips.length - visibleChips.length)

  if (variant === "list") {
    return (
      <Item className={cn("min-h-[112px] items-start", className)}>
        <ItemMedia className="bg-muted relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl">
          {thumbImageUrl ? (
            <Image
              src={thumbImageUrl}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <>
              <div className="bg-background absolute inset-0" aria-hidden />
              <GridPattern
                patternId={patternId}
                squares={headerSquares}
                className="absolute inset-0 [mask-image:radial-gradient(100px_circle_at_center,white,transparent)] fill-gray-500/50 stroke-gray-500/50 opacity-80 dark:fill-white/15 dark:stroke-white/25"
              />
            </>
          )}
        </ItemMedia>
        <ItemContent className="space-y-1.5">
          {showStatusBadge && statusLabel ? (
            <Badge
              variant="secondary"
              className="w-fit rounded-full px-2 py-0.5 text-[10px]"
            >
              {statusLabel}
            </Badge>
          ) : null}
          <ItemTitle className="line-clamp-2">{title}</ItemTitle>
          {org || location ? (
            <ItemDescription className="line-clamp-1 text-xs">
              {[org, location].filter(Boolean).join(" · ")}
            </ItemDescription>
          ) : null}
          {description ? (
            <ItemDescription className="line-clamp-2 text-[13px] leading-5">
              {description}
            </ItemDescription>
          ) : null}
        </ItemContent>
        <ItemActions className="self-start">
          {ctaHref ? (
            <Button size="sm" variant="outline" asChild>
              <a
                href={ctaHref}
                target={ctaTarget}
                rel={ctaTarget === "_blank" ? "noopener noreferrer" : undefined}
              >
                {ctaLabel}
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onCtaClick}
              disabled={!onCtaClick}
            >
              {ctaLabel}
            </Button>
          )}
        </ItemActions>
      </Item>
    )
  }

  const cardSizeClasses = compact
    ? "max-w-none min-h-0 rounded-[25px]"
    : variant === "full"
      ? "max-w-none min-h-[560px]"
      : "max-w-[380px] min-h-[480px]"

  return (
    <Card
      className={cn(
        "border-muted/50 flex w-full flex-col gap-0 overflow-hidden rounded-3xl py-0 shadow-sm",
        cardSizeClasses,
        className
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "bg-muted relative overflow-hidden",
            variant === "full" ? "aspect-[21/9]" : "aspect-[16/9]"
          )}
        >
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt="Program visual"
              fill
              className="object-cover"
              sizes={
                variant === "full"
                  ? "(max-width: 1024px) 90vw, 900px"
                  : "(max-width: 768px) 90vw, 380px"
              }
            />
          ) : (
            <>
              <div className="bg-background absolute inset-0" aria-hidden />
              <GridPattern
                patternId={patternId}
                squares={headerSquares}
                className="absolute inset-0 [mask-image:radial-gradient(220px_circle_at_center,white,transparent)] fill-gray-500/50 stroke-gray-500/50 opacity-85 dark:fill-white/15 dark:stroke-white/25"
              />
            </>
          )}
          {showStatusBadge && statusLabel ? (
            <div className="absolute top-3 right-3">
              <Badge
                variant="secondary"
                className="rounded-full border border-white/30 bg-white/50 px-3 py-1 text-xs font-medium backdrop-blur-sm dark:border-white/20 dark:bg-black/40"
              >
                {statusLabel}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      <CardContent
        className={cn(
          "bg-background flex flex-col",
          compact ? "gap-2 p-3" : "gap-3 px-4 pt-3 pb-4",
          contentFill && !compact && "flex-1"
        )}
      >
        <div className="space-y-1">
          <h3
            className={cn(
              "line-clamp-2 font-semibold",
              compact ? "text-sm leading-5" : "text-lg leading-6"
            )}
          >
            {title}
          </h3>
          {org || location ? (
            <p className="text-muted-foreground line-clamp-1 text-sm">
              {[org, location].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {description ? (
            <p className="text-muted-foreground line-clamp-2 text-sm leading-5">
              {description}
            </p>
          ) : null}
        </div>

        <Separator />

        {visibleChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {visibleChips.map((c, i) => (
              <Badge
                key={`${c}-${i}`}
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-xs"
              >
                {c}
              </Badge>
            ))}
            {extraChipCount > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-full px-2 py-0.5 text-xs"
              >
                +{extraChipCount}
              </Badge>
            ) : null}
          </div>
        ) : null}

        {!compact || visibleChips.length > 0 ? <Separator /> : null}

        <div className={cn("flex flex-col gap-1.5", !compact && "mt-2")}>
          <div
            className={cn(
              "flex items-baseline justify-between",
              compact ? "flex-wrap gap-x-2 gap-y-1 text-xs" : "text-sm"
            )}
          >
            <span className="font-medium">Fundraising Progress</span>
            <span className="text-muted-foreground tabular-nums">
              {money(raised)} / {money(goal)}
              {asOfText ? ` · ${asOfText}` : ""}
            </span>
          </div>
          <Progress value={pct} aria-label={`Funding progress ${pct}%`} />
          <div className="text-muted-foreground text-xs">{pct}% funded</div>
        </div>
      </CardContent>

      <CardFooter
        className={cn(
          "bg-background flex justify-end",
          compact ? "px-3 pt-0 pb-2" : "px-4 pt-0 pb-4"
        )}
      >
        {ctaHref ? (
          <Button
            size="sm"
            className={compact ? WORKSPACE_PARTICLE_CHROME.action : undefined}
            asChild
          >
            <a
              href={ctaHref}
              target={ctaTarget}
              rel={ctaTarget === "_blank" ? "noopener noreferrer" : undefined}
            >
              {ctaLabel}
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            className={compact ? WORKSPACE_PARTICLE_CHROME.action : undefined}
            onClick={onCtaClick}
            disabled={!onCtaClick}
          >
            {ctaLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
