// SVG icons from Anish: https://lab.anishfn.ink/r/shapeshift.json
// Retrieved 2026-10-13. Geometry preserved; exports adapted for our components.
import type { ReactNode, SVGProps } from "react"

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number }

export function Icon({
  size = 18,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const
const puff = {
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinejoin: "round",
} as const

export function CalendarIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect {...line} x="3.2" y="4.3" width="11.6" height="10.4" rx="2.4" />
      <path {...line} d="M3.6 7.7h10.8M6.4 2.9v2.6M11.6 2.9v2.6" />
      <circle cx="6.6" cy="10.6" r="1" />
      <circle cx="9" cy="10.6" r="1" />
    </Icon>
  )
}

export function MailIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect {...line} x="3" y="4.4" width="12" height="9.2" rx="2.2" />
      <path {...line} d="M3.9 5.7L9 9.4l5.1-3.7" />
    </Icon>
  )
}

export function ChecklistIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M3.3 5.5l1.25 1.25 2.3-2.5M9.4 5.6h5.3M9.4 12.2h5.3" />
      <circle {...line} cx="4.9" cy="12.2" r="1.7" />
    </Icon>
  )
}

export function TimerIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...line} cx="9" cy="10.2" r="5.1" />
      <path {...line} d="M9 10.2V7.5M7.4 2.9h3.2" />
    </Icon>
  )
}

export function UsersIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...puff} cx="5.9" cy="6.5" r="1.8" />
      <circle {...puff} cx="12.1" cy="6.5" r="1.8" />
      <path
        {...puff}
        d="M3.75 13.3c.28-1.6 1.05-2.45 2.15-2.45s1.87.85 2.15 2.45c.07.42-.23.8-.66.8H4.41c-.43 0-.73-.38-.66-.8z"
      />
      <path
        {...puff}
        d="M9.95 13.3c.28-1.6 1.05-2.45 2.15-2.45s1.87.85 2.15 2.45c.07.42-.23.8-.66.8h-2.98c-.43 0-.73-.38-.66-.8z"
      />
    </Icon>
  )
}

export function PollIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect
        {...puff}
        strokeWidth={1}
        x="3.6"
        y="4"
        width="10.8"
        height="2.2"
        rx="1.1"
      />
      <rect
        {...puff}
        strokeWidth={1}
        x="3.6"
        y="7.9"
        width="6.6"
        height="2.2"
        rx="1.1"
      />
      <rect
        {...puff}
        strokeWidth={1}
        x="3.6"
        y="11.8"
        width="8.8"
        height="2.2"
        rx="1.1"
      />
    </Icon>
  )
}

export function DropIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path
        {...puff}
        strokeWidth={1.5}
        d="M9 3.4c2.3 2.6 3.7 4.6 3.7 6.5a3.7 3.7 0 01-7.4 0c0-1.9 1.4-3.9 3.7-6.5z"
      />
    </Icon>
  )
}

export function CalculatorIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect {...line} x="4" y="2.9" width="10" height="12.2" rx="2.4" />
      <rect
        {...puff}
        strokeWidth={1}
        x="6.4"
        y="5.2"
        width="5.2"
        height="1.8"
        rx=".6"
      />
      <circle cx="6.9" cy="10.1" r=".85" />
      <circle cx="9" cy="10.1" r=".85" />
      <circle cx="11.1" cy="10.1" r=".85" />
      <circle cx="6.9" cy="12.6" r=".85" />
      <circle cx="9" cy="12.6" r=".85" />
      <circle cx="11.1" cy="12.6" r=".85" />
    </Icon>
  )
}

export function CheckIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M4.4 9.6l3 3 6.2-6.4" />
    </Icon>
  )
}

export function CopyIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path
        {...puff}
        d="M5.4 3h3.9a2.5 2.5 0 012.3 1.5H6.6a2.1 2.1 0 00-2.1 2.1v5.1A2.5 2.5 0 013 9.4V5.4A2.4 2.4 0 015.4 3z"
      />
      <rect {...puff} x="6.6" y="6.6" width="8.4" height="8.4" rx="2.6" />
    </Icon>
  )
}

export function PlusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M9 4.25v9.5M4.25 9h9.5" />
    </Icon>
  )
}

export function MinusIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M4.25 9h9.5" />
    </Icon>
  )
}

export function PlayIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path
        {...puff}
        strokeWidth={1.5}
        d="M6.6 4.9v8.2c0 .58.64.93 1.13.6l6.1-4.1a.72.72 0 000-1.2l-6.1-4.1c-.49-.33-1.13.02-1.13.6z"
      />
    </Icon>
  )
}

export function PauseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect
        {...puff}
        strokeWidth={1.5}
        x="5"
        y="4.5"
        width="2.6"
        height="9"
        rx="1"
      />
      <rect
        {...puff}
        strokeWidth={1.5}
        x="10.4"
        y="4.5"
        width="2.6"
        height="9"
        rx="1"
      />
    </Icon>
  )
}

export function ClockIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...line} cx="9" cy="9" r="5.7" />
      <path {...line} d="M9 6.1V9l1.9 1.3" />
    </Icon>
  )
}

export function VideoIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect {...line} x="2.6" y="5" width="8.4" height="8" rx="2.3" />
      <path
        {...line}
        d="M11.2 8.3l3.2-1.9c.3-.2.6 0 .6.3v4.6c0 .3-.3.5-.6.3l-3.2-1.9"
      />
    </Icon>
  )
}

export function ResetIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M4.4 6A5.8 5.8 0 1 1 3.4 9.8M4 2.8v3.5h3.5" />
    </Icon>
  )
}

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...line} d="M5.25 12.75l7.5-7.5M6.75 5.25h6v6" />
    </Icon>
  )
}
