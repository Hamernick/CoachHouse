import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list"
import ListChecksIcon from "lucide-react/dist/esm/icons/list-checks"
import CalendarDaysIcon from "lucide-react/dist/esm/icons/calendar-days"
import PeopleIcon from "lucide-react/dist/esm/icons/users"
import GitBranchIcon from "lucide-react/dist/esm/icons/git-branch"
import ChartNoAxesCombinedIcon from "lucide-react/dist/esm/icons/chart-no-axes-combined"
import WalletIcon from "lucide-react/dist/esm/icons/wallet"
import type { Particle } from "../types"
import FileIcon from "lucide-react/dist/esm/icons/file-text"
import NotebookPenIcon from "lucide-react/dist/esm/icons/notebook-pen"
import ImageIcon from "lucide-react/dist/esm/icons/image"
import {
  CalendarIcon,
  MailIcon,
  ChecklistIcon,
  TimerIcon,
  UsersIcon,
  PollIcon,
  DropIcon,
  CalculatorIcon,
} from "./shapeshift-icons"

export const PARTICLE_PRESET_ICONS = {
  form: ClipboardListIcon,
  notes: NotebookPenIcon,
  event: CalendarIcon,
  message: MailIcon,
  list: ChecklistIcon,
  timer: TimerIcon,
  split: UsersIcon,
  poll: PollIcon,
  color: DropIcon,
  sum: CalculatorIcon,
}

export function particlePresetIcon(particle: Particle) {
  if (particle.type === "activity" && particle.data.widget) {
    const kind = particle.data.widget.kind
    if (kind === "document") return FileIcon
    if (kind === "image" || kind === "image_placeholder") return ImageIcon
    return kind === "calculate" ? CalculatorIcon : PARTICLE_PRESET_ICONS[kind]
  }
  if (particle.type === "workflow") return ChecklistIcon
  if (
    particle.type === "calendar" &&
    particle.data.entries.length === 1 &&
    particle.data.entries[0].contentType === "email"
  )
    return MailIcon
  if (
    particle.type === "decision" &&
    particle.data.outcomes.every((outcome) => /^option-\d+$/.test(outcome.id))
  )
    return PollIcon
  return null
}

const ICONS = {
  objective: ChecklistIcon,
  activity: ListChecksIcon,
  calendar: CalendarDaysIcon,
  people: PeopleIcon,
  decision: GitBranchIcon,
  metric: ChartNoAxesCombinedIcon,
  workflow: ListChecksIcon,
  finance: WalletIcon,
}

export function particleIcon(particle: Particle) {
  return particlePresetIcon(particle) ?? ICONS[particle.type]
}
