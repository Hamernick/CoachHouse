export type CoachDashboardInput = {
  scope?: "assigned" | "all"
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    role: string
  }
  organizations: { id: string; name: string; href: string }[]
  projects: {
    id: string
    name: string
    organization: string
    dueDate: string
    status: string
  }[]
  organizationCount: number | null
  projectCount: number | null
  tasks: {
    id: string
    name: string
    organization: string
    dueDate: string
    projectId: string
  }[]
  taskCount: number | null
  activity: {
    id: string
    title: string
    organization: string
    occurredAt: string
    href: string
    kind: string
  }[]
  personalActivity: string[]
  activityTruncated: boolean
  issues: string[]
  loadedAt: string
}
