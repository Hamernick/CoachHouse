import { formatDistanceStrict } from "date-fns"

import type { Database } from "@/lib/supabase"
import type { ProjectActivityItem } from "@/features/platform-admin-dashboard"
import { isMissingMemberWorkspaceTableError } from "./table-errors"
import { resolveMemberWorkspaceActorContext } from "./member-workspace-actor-context"

class ActivitySchemaUnavailable extends Error {}

export type { OrganizationActivityResult } from "../lib/project-activity-types"
import type { OrganizationActivityResult } from "../lib/project-activity-types"

export async function loadOrganizationProjectActivityResult(
  input: Parameters<typeof loadOrganizationProjectActivity>[0]
): Promise<OrganizationActivityResult> {
  try {
    return {
      state: "ready",
      items: await loadOrganizationProjectActivity(input),
    }
  } catch (error) {
    return {
      state:
        error instanceof ActivitySchemaUnavailable ? "unavailable" : "error",
      items: [],
    }
  }
}

type ActivityRow =
  Database["public"]["Tables"]["organization_project_activity_events"]["Row"]

export async function loadOrganizationProjectActivity({
  orgId,
  projectId,
  supabase,
}: {
  orgId: string
  projectId: string
  supabase: Awaited<
    ReturnType<typeof resolveMemberWorkspaceActorContext>
  >["supabase"]
}): Promise<ProjectActivityItem[]> {
  const { data, error } = await supabase
    .from("organization_project_activity_events")
    .select(
      "id, org_id, project_id, entity_type, entity_id, event_type, title, from_status, to_status, actor_id, metadata, occurred_at"
    )
    .eq("org_id", orgId)
    .or(`project_id.eq.${projectId},entity_type.in.(program,document,file)`)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200)
    .returns<ActivityRow[]>()

  if (error) {
    if (
      isMissingMemberWorkspaceTableError(
        error,
        "organization_project_activity_events"
      )
    ) {
      throw new ActivitySchemaUnavailable(
        "Activity history is not available yet."
      )
    }
    throw new Error("Unable to load organization activity.")
  }

  const previousByEntity = new Map<string, ActivityRow>()
  const items = [...(data ?? [])].reverse().map((row) => {
    const entityKey = `${row.entity_type}:${row.entity_id}`
    const previous = previousByEntity.get(entityKey)
    if (row.to_status) previousByEntity.set(entityKey, row)
    const previousDate = previous ? new Date(previous.occurred_at) : null
    const currentDate = new Date(row.occurred_at)
    const durationLabel =
      row.to_status &&
      previousDate &&
      currentDate.getTime() >= previousDate.getTime()
        ? formatDistanceStrict(previousDate, currentDate)
        : null

    return {
      id: row.id,
      entityType: row.entity_type as ProjectActivityItem["entityType"],
      eventType: row.event_type,
      title: row.title,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      occurredAt: currentDate,
      durationLabel,
    }
  })

  return items.reverse()
}
