import { FileText, Layers, Flag, ListTree, Image, ListChecks, CalendarDays, Users, GitBranch, ChartNoAxesCombined, Wallet, Plus } from "lucide-react"
import { PARTICLE_PRESET_ICONS } from "./particle-preset-icons"

const icons = { ...PARTICLE_PRESET_ICONS, objective: Flag, activity: ListChecks, calendar: CalendarDays,
  people: Users, decision: GitBranch, metric: ChartNoAxesCombined, finance: Wallet, image: Image,
  Particles: Layers, Documents: FileText, Objectives: Flag, Plans: ListTree }
const blue = "text-blue-600 dark:text-blue-400"
const violet = "text-violet-600 dark:text-violet-400"
const teal = "text-teal-700 dark:text-teal-400"
const amber = "text-amber-700 dark:text-amber-400"
const rose = "text-rose-600 dark:text-rose-400"
const colors: Record<string,string> = { objective:violet, activity:blue, calendar:rose, people:teal,
  decision:amber, metric:blue, finance:teal, image:violet, data_view:teal, form:blue, notes:amber,
  event:rose, poll:violet, Particles:violet, Documents:blue, Objectives:violet, Plans:teal }
export function composerMenuIcon(key: string) {
  return { Icon:icons[key as keyof typeof icons] ?? Plus, color:colors[key] ?? blue }
}
