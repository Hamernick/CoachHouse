import type { Node as ReactFlowNode } from "@xyflow/react"
import {
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"

type UserJourneyOutlineTone =
  | "auth"
  | "pricing"
  | "free"
  | "organization"
  | "operations"

export type UserJourneyOutlineNodeData = {
  subtitle: string
  title: string
  tone: UserJourneyOutlineTone
}

const OUTLINE_NODE_WIDTH = 228
const OUTLINE_NODE_HEIGHT = 92

const USER_JOURNEY_OUTLINE_NODES: Array<
  UserJourneyOutlineNodeData & {
    id: string
    x: number
    y: number
  }
> = [
  {
    id: "outline-pricing",
    title: "Pricing",
    subtitle: "User compares Individual, Organization, and Operations Support.",
    tone: "pricing",
    x: 96,
    y: -480,
  },
  {
    id: "outline-login",
    title: "Login page",
    subtitle: "/login sends signed-out users to the home login panel.",
    tone: "auth",
    x: 96,
    y: -800,
  },
  {
    id: "outline-login-signup",
    title: "Need account? Sign up",
    subtitle: "The login form sign-up link preserves the intended redirect.",
    tone: "auth",
    x: 388,
    y: -800,
  },
  {
    id: "outline-signup-route",
    title: "/sign-up route",
    subtitle:
      "Normalizes plan, intent, and redirect before creating the account.",
    tone: "auth",
    x: 388,
    y: -480,
  },
  {
    id: "outline-free-plan",
    title: "Free journey",
    subtitle: "Choose Individual and create a free account.",
    tone: "free",
    x: 680,
    y: -640,
  },
  {
    id: "outline-free-confirm",
    title: "Confirm email",
    subtitle: "Human confirmation sends the user back into Coach House.",
    tone: "free",
    x: 972,
    y: -640,
  },
  {
    id: "outline-free-onboarding",
    title: "Pick path",
    subtitle:
      "Onboarding asks build, find, fund, or support after confirmation.",
    tone: "free",
    x: 1264,
    y: -640,
  },
  {
    id: "outline-free-destination",
    title: "Free destination",
    subtitle:
      "Builders enter the free workspace; member paths continue to Find.",
    tone: "free",
    x: 1556,
    y: -640,
  },
  {
    id: "outline-org-plan",
    title: "$20 journey",
    subtitle: "Choose Organization and create the account.",
    tone: "organization",
    x: 680,
    y: -480,
  },
  {
    id: "outline-org-confirm",
    title: "Confirm email",
    subtitle: "Verification resumes the selected paid builder path.",
    tone: "organization",
    x: 972,
    y: -480,
  },
  {
    id: "outline-org-checkout",
    title: "Stripe checkout",
    subtitle: "Organization checkout starts before workspace setup.",
    tone: "organization",
    x: 1264,
    y: -480,
  },
  {
    id: "outline-org-workspace",
    title: "Workspace setup",
    subtitle: "Complete onboarding with team access and accelerator unlocked.",
    tone: "organization",
    x: 1556,
    y: -480,
  },
  {
    id: "outline-ops-plan",
    title: "$58 journey",
    subtitle: "Choose Operations Support and create the account.",
    tone: "operations",
    x: 680,
    y: -320,
  },
  {
    id: "outline-ops-confirm",
    title: "Confirm email",
    subtitle: "Verification resumes the selected support-tier path.",
    tone: "operations",
    x: 972,
    y: -320,
  },
  {
    id: "outline-ops-checkout",
    title: "Stripe checkout",
    subtitle: "Operations Support checkout starts before workspace setup.",
    tone: "operations",
    x: 1264,
    y: -320,
  },
  {
    id: "outline-ops-workspace",
    title: "Support workspace",
    subtitle:
      "Complete onboarding with workspace, coaching, and support active.",
    tone: "operations",
    x: 1556,
    y: -320,
  },
]

const USER_JOURNEY_OUTLINE_EDGES: Array<{ from: string; to: string }> = [
  { from: "outline-login", to: "outline-login-signup" },
  { from: "outline-login-signup", to: "outline-signup-route" },
  { from: "outline-pricing", to: "outline-signup-route" },
  { from: "outline-signup-route", to: "outline-free-plan" },
  { from: "outline-free-plan", to: "outline-free-confirm" },
  { from: "outline-free-confirm", to: "outline-free-onboarding" },
  { from: "outline-free-onboarding", to: "outline-free-destination" },
  { from: "outline-signup-route", to: "outline-org-plan" },
  { from: "outline-org-plan", to: "outline-org-confirm" },
  { from: "outline-org-confirm", to: "outline-org-checkout" },
  { from: "outline-org-checkout", to: "outline-org-workspace" },
  { from: "outline-signup-route", to: "outline-ops-plan" },
  { from: "outline-ops-plan", to: "outline-ops-confirm" },
  { from: "outline-ops-confirm", to: "outline-ops-checkout" },
  { from: "outline-ops-checkout", to: "outline-ops-workspace" },
]

function getOutlineToneClassName(tone: UserJourneyOutlineTone) {
  if (tone === "auth") return "border-border bg-card"
  if (tone === "organization") return "border-foreground bg-card"
  if (tone === "operations") return "border-border bg-muted"
  if (tone === "free") return "border-border bg-background"
  return "border-foreground bg-background"
}

export function UserJourneyOutlineNode({
  data,
  isConnectable,
}: NodeProps<ReactFlowNode<UserJourneyOutlineNodeData>>) {
  return (
    <article
      className={`relative flex h-full w-full flex-col justify-center rounded-md border px-4 py-3 shadow-sm ${getOutlineToneClassName(data.tone)}`}
      data-user-journey-outline-node="true"
      role="group"
      aria-label={`${data.title}: ${data.subtitle}`}
    >
      <Handle
        className="pointer-events-none size-1 border-0 bg-transparent opacity-0"
        id="target"
        isConnectable={isConnectable}
        position={Position.Left}
        type="target"
      />
      <p className="text-foreground text-sm leading-5 font-semibold">
        {data.title}
      </p>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-4">
        {data.subtitle}
      </p>
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

export function buildUserJourneyOutlineNodes(): Array<
  Node<UserJourneyOutlineNodeData>
> {
  return USER_JOURNEY_OUTLINE_NODES.map((node) => ({
    data: {
      subtitle: node.subtitle,
      title: node.title,
      tone: node.tone,
    },
    draggable: true,
    id: node.id,
    position: { x: node.x, y: node.y },
    selectable: false,
    sourcePosition: Position.Right,
    style: {
      height: OUTLINE_NODE_HEIGHT,
      width: OUTLINE_NODE_WIDTH,
    },
    targetPosition: Position.Left,
    type: "userJourneyOutline",
    zIndex: 20,
  }))
}

export function buildUserJourneyOutlineEdges(): Edge[] {
  return USER_JOURNEY_OUTLINE_EDGES.map((edge, index) => ({
    id: `outline-edge-${index + 1}`,
    interactionWidth: 18,
    markerEnd: {
      color: "hsl(var(--foreground))",
      type: MarkerType.ArrowClosed,
    },
    selectable: false,
    source: edge.from,
    sourceHandle: "source",
    style: {
      stroke: "hsl(var(--foreground))",
      strokeOpacity: 0.64,
      strokeWidth: 2,
    },
    target: edge.to,
    targetHandle: "target",
    type: "smoothstep",
  }))
}
