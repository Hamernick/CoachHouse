import type { ProjectActivityItem } from "@/features/platform-admin-dashboard"

export type OrganizationActivityResult =
  | { state: "ready"; items: ProjectActivityItem[] }
  | {
      state: "unavailable" | "error" | "forbidden"
      items: ProjectActivityItem[]
    }
