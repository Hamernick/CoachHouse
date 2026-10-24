"use client"

import ActivityIcon from "lucide-react/dist/esm/icons/activity"
import BotIcon from "lucide-react/dist/esm/icons/bot"
import CalendarCheckIcon from "lucide-react/dist/esm/icons/calendar-check"
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import CreditCardIcon from "lucide-react/dist/esm/icons/credit-card"
import DatabaseIcon from "lucide-react/dist/esm/icons/database"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import LayoutDashboardIcon from "lucide-react/dist/esm/icons/layout-dashboard"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import RouteIcon from "lucide-react/dist/esm/icons/route"
import Settings2Icon from "lucide-react/dist/esm/icons/settings-2"
import TargetIcon from "lucide-react/dist/esm/icons/target"
import ShieldCheckIcon from "lucide-react/dist/esm/icons/shield-check"
import UsersIcon from "lucide-react/dist/esm/icons/users"
import type { CSSProperties } from "react"
import { Handle, Position } from "@xyflow/react"

import { cn } from "@/lib/utils"

import type {
  UserJourneyAtlasHealthStatus,
  UserJourneyAtlasNode,
  UserJourneyAtlasSurfaceKind,
} from "../types"
import { UserJourneyDefaultCardBody } from "./user-journey-atlas-node-card-bodies"

type UserJourneySurfaceKindStyle = {
  accent: string
  cardClassName: string
  dataHeading: string
  edge: string
  icon: typeof MailIcon
  iconClassName: string
}

type UserJourneyHealthStatusStyle = {
  color: string
}

const USER_JOURNEY_SURFACE_KIND_STYLES: Record<
  UserJourneyAtlasSurfaceKind,
  UserJourneySurfaceKindStyle
> = {
  ai: {
    accent: "#6d28d9",
    cardClassName: "border-border bg-card",
    dataHeading: "Assistant inputs",
    edge: "#7c3aed",
    icon: BotIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  access: {
    accent: "#4f46e5",
    cardClassName: "border-border bg-card",
    dataHeading: "Access data",
    edge: "#6366f1",
    icon: UsersIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  admin: {
    accent: "#64748b",
    cardClassName: "border-border bg-card",
    dataHeading: "Admin context",
    edge: "#94a3b8",
    icon: Settings2Icon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  auth: {
    accent: "#7c3aed",
    cardClassName: "border-border bg-card",
    dataHeading: "Auth state",
    edge: "#8b5cf6",
    icon: ShieldCheckIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  coaching: {
    accent: "#0369a1",
    cardClassName: "border-border bg-card",
    dataHeading: "Booking state",
    edge: "#0ea5e9",
    icon: CalendarCheckIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  data: {
    accent: "#dc2626",
    cardClassName: "border-border bg-card",
    dataHeading: "Stored data",
    edge: "#ef4444",
    icon: DatabaseIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  email: {
    accent: "#db2777",
    cardClassName: "border-dashed border-border bg-card",
    dataHeading: "Email payload",
    edge: "#ec4899",
    icon: MailIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  form: {
    accent: "#b45309",
    cardClassName: "border-border bg-card",
    dataHeading: "Fields",
    edge: "#f59e0b",
    icon: ClipboardListIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  outcome: {
    accent: "#2563eb",
    cardClassName: "border-border bg-card",
    dataHeading: "Value loop",
    edge: "#2563eb",
    icon: TargetIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  payment: {
    accent: "#059669",
    cardClassName: "border-double border-border bg-card",
    dataHeading: "Billing data",
    edge: "#10b981",
    icon: CreditCardIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  route: {
    accent: "#2563eb",
    cardClassName: "border-border bg-card",
    dataHeading: "Route state",
    edge: "#3b82f6",
    icon: RouteIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  system: {
    accent: "#334155",
    cardClassName: "border-border bg-card",
    dataHeading: "Inputs",
    edge: "#64748b",
    icon: FileTextIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  telemetry: {
    accent: "#475569",
    cardClassName: "border-border bg-card",
    dataHeading: "Event coverage",
    edge: "#64748b",
    icon: ActivityIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
  workspace: {
    accent: "#0f766e",
    cardClassName: "border-border bg-card",
    dataHeading: "Workspace state",
    edge: "#14b8a6",
    icon: LayoutDashboardIcon,
    iconClassName: "bg-muted text-muted-foreground",
  },
}

const USER_JOURNEY_HEALTH_STATUS_STYLES: Record<
  UserJourneyAtlasHealthStatus,
  UserJourneyHealthStatusStyle
> = {
  "activation-gap": { color: "#2563eb" },
  "admin-reference": { color: "#64748b" },
  "ai-stub": { color: "#7c3aed" },
  "integration-gap": { color: "#b45309" },
  live: { color: "#15803d" },
  "recovery-gap": { color: "#dc2626" },
  "telemetry-gap": { color: "#475569" },
}

export function getUserJourneySurfaceKindStyle(
  surfaceKind: UserJourneyAtlasSurfaceKind,
) {
  return USER_JOURNEY_SURFACE_KIND_STYLES[surfaceKind]
}

export function getUserJourneyHealthStatusStyle(
  healthStatus: UserJourneyAtlasHealthStatus,
) {
  return USER_JOURNEY_HEALTH_STATUS_STYLES[healthStatus]
}

function UserJourneyHealthStatusPanel({
  node,
}: {
  node: UserJourneyAtlasNode
}) {
  const healthStyle = getUserJourneyHealthStatusStyle(node.healthStatus)

  return (
    <section
      className="mt-2 rounded-md border border-border bg-muted px-2.5 py-1.5"
      data-user-journey-health-status={node.healthStatus}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: healthStyle.color }}
        />
        <p
          className="truncate text-[10px] font-semibold uppercase leading-4"
          style={{ color: healthStyle.color }}
          title={node.healthStatusLabel}
        >
          {node.healthStatusLabel}
        </p>
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
        {node.healthSummary}
      </p>
    </section>
  )
}

export function UserJourneyAtlasNodeCard({
  isConnectable,
  node,
}: {
  isConnectable: boolean
  node: UserJourneyAtlasNode
}) {
  const surfaceStyle = getUserJourneySurfaceKindStyle(node.surfaceKind)
  const SurfaceIcon = surfaceStyle.icon
  const primarySystemEvent =
    node.systemEvents[0] ?? "Moves the user into the next journey step."
  const primaryNextStep =
    node.nextStepLabels[0] ?? "Terminal step or admin-only reference."

  return (
    <article
      className={cn(
        "relative flex cursor-grab flex-col overflow-hidden rounded-lg border p-3 shadow-sm transition-[border-color,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/25 hover:bg-card hover:shadow-md active:cursor-grabbing motion-reduce:transition-none",
        surfaceStyle.cardClassName,
      )}
      style={{
        "--journey-accent": surfaceStyle.accent,
        height: node.height,
        width: node.width,
      } as CSSProperties}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: surfaceStyle.accent }}
      />
      <Handle
        className="pointer-events-none size-1 border-0 bg-transparent opacity-0"
        id="target"
        isConnectable={isConnectable}
        position={Position.Left}
        type="target"
      />
      <div className="mt-1 flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-md",
            surfaceStyle.iconClassName,
          )}
        >
          <SurfaceIcon aria-hidden="true" className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[10px] font-semibold uppercase leading-4"
            style={{ color: surfaceStyle.accent }}
            title={node.categoryLabel}
          >
            {String(node.journeyStep).padStart(2, "0")} / {node.categoryLabel}
          </p>
          <h2 className="truncate text-sm font-semibold leading-6 text-foreground">
            {node.title}
          </h2>
        </div>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[10px] leading-4 text-muted-foreground">
        <span className="font-semibold uppercase" style={{ color: surfaceStyle.accent }}>
          {node.surfaceKindLabel}
        </span>
        <span className="truncate text-right" title={node.fileKindLabel}>
          {node.fileKindLabel}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground">
        {node.route}
      </p>

      <UserJourneyHealthStatusPanel node={node} />
      <UserJourneyDefaultCardBody node={node} surfaceStyle={surfaceStyle} />

      <div className="mt-2 grid gap-1.5 border-t border-border/60 pt-1.5">
        <p className="truncate text-[10px] leading-4 text-muted-foreground">
          Action: {primarySystemEvent}
        </p>
        <p className="truncate text-[10px] leading-4 text-muted-foreground">
          Next: {primaryNextStep}
        </p>
        <div className="flex min-w-0 items-center gap-1.5">
          <FileTextIcon
            aria-hidden="true"
            className="size-3 shrink-0 text-muted-foreground"
          />
          <code className="truncate text-[10px] text-muted-foreground">
            {node.file}
          </code>
        </div>
      </div>
      <Handle
        className="pointer-events-none size-1 border-0 bg-transparent opacity-0"
        id="source"
        isConnectable={isConnectable}
        position={Position.Right}
        type="source"
      />
    </article>
  )
}
