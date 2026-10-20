export {
  PlatformLabClientDetailsRoute,
  PlatformLabClientsPage,
  PlatformLabInboxPage,
  PlatformLabPerformancePage,
  PlatformLabProjectDetailsLoading,
  PlatformLabProjectDetailsRoute,
  PlatformLabProjectsPage,
  PlatformLabTasksPage,
} from "./components/public-platform-lab-pages"
export { ProgressCircle } from "./upstream/components/progress-circle"
export { TaskRowBase } from "./upstream/components/tasks/TaskRowBase"
export { ChipOverflow } from "./upstream/components/chip-overflow"
export {
  FilterPopover,
  type FilterPopoverMemberOption,
  type FilterPopoverTagOption,
} from "./upstream/components/filter-popover"
export {
  PriorityBadge,
  type PriorityLevel,
} from "./upstream/components/priority-badge"
export { Badge } from "./upstream/components/ui/badge"
export { Button } from "./upstream/components/ui/button"
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./upstream/components/ui/dialog"
export { Input } from "./upstream/components/ui/input"
export { Separator } from "./upstream/components/ui/separator"
export { Skeleton } from "./upstream/components/ui/skeleton"
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./upstream/components/ui/tabs"
export { BacklogCard } from "./upstream/components/projects/BacklogCard"
export { Breadcrumbs } from "./upstream/components/projects/Breadcrumbs"
export { KeyFeaturesColumns } from "./upstream/components/projects/KeyFeaturesColumns"
export { MetaChipsRow } from "./upstream/components/projects/MetaChipsRow"
export { OutcomesList } from "./upstream/components/projects/OutcomesList"
export { ScopeColumns } from "./upstream/components/projects/ScopeColumns"
export { TimeCard } from "./upstream/components/projects/TimeCard"
export {
  AssetsFilesTab,
  NotesTab,
  ProjectTasksTab,
  ProjectWizard,
  QuickLinksCard,
  TaskQuickCreateModal,
  TimelineGantt,
  WorkstreamTab,
} from "./components/public-heavy-exports"
export type {
  NoteUploadKind,
  UploadedNoteAsset,
} from "./upstream/components/projects/note-upload"
export {
  type CreateTaskContext,
  type TaskQuickCreateSubmitValue,
} from "./upstream/components/tasks/TaskQuickCreateModal"
export { TAG_OPTIONS } from "./lib/task-quick-create-options"
export {
  ProjectTaskListView,
  computeTaskFilterCounts,
  filterTasksByChips,
  type ProjectTaskGroup,
} from "./upstream/components/tasks/task-helpers"
export type { StepQuickCreateValue } from "./upstream/components/project-wizard/steps/StepQuickCreate"
export type {
  ProjectData,
  ProjectIntent,
} from "./upstream/components/project-wizard/types"
export type { Client } from "./upstream/lib/data/clients"
export type {
  BacklogSummary,
  KeyFeatures,
  NoteStatus,
  NoteType,
  ProjectActivityItem,
  ProjectDetails,
  ProjectFile,
  ProjectMeta,
  ProjectNote,
  ProjectScope,
  QuickLink,
  TimeSummary,
  TimelineTask,
  User,
  WorkstreamGroup,
  WorkstreamTask,
  ProjectTask,
} from "./upstream/lib/data/project-details"
export type { Project } from "./upstream/lib/data/projects"
export type { FilterChip } from "./upstream/lib/view-options"
export {
  filterPlatformAdminDashboardLabProjects,
  groupPlatformAdminDashboardLabProjectsByStatus,
  platformAdminDashboardLabProjects,
  summarizePlatformAdminDashboardLabProjects,
} from "./lib/platform-admin-dashboard-lab"
export type {
  PlatformAdminDashboardLabFiscalSponsorshipStatus,
  PlatformAdminDashboardLabPriority,
  PlatformAdminDashboardLabProject,
  PlatformAdminDashboardLabState,
  PlatformAdminDashboardLabStatus,
  PlatformAdminDashboardLabTask,
  PlatformAdminDashboardLabViewType,
} from "./types"

export { EditableOptionPicker, type EditableOption } from "./upstream/components/project-wizard/EditableOptionPicker"
export { PROJECT_WORKSTREAM_OPTIONS } from "./upstream/lib/project-workstreams"
