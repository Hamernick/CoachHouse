import { describe, expect, it } from "vitest"

import { buildMemberWorkspaceProjectDetails } from "@/features/member-workspace/server/project-detail-view-model"
import type { OrganizationProjectRecord } from "@/features/member-workspace/server/project-starter-data"

describe("buildMemberWorkspaceProjectDetails", () => {
  it("maps persisted project rows into a detail view model with grouped tasks", () => {
    const project: OrganizationProjectRecord = {
      id: "project-1",
      org_id: "org-1",
      canonical_org_id: null,
      project_kind: "standard",
      name: "Neighborhood Grants Rollout",
      status: "active",
      priority: "high",
      progress: 55,
      start_date: "2026-04-01",
      end_date: "2026-04-20",
      client_name: "Coach House",
      type_label: "Launch",
      duration_label: "3 weeks",
      tags: ["community", "grants"],
      member_labels: ["Jason Duong"],
      task_count: 2,
      description:
        "<p><strong>Goal:</strong></p><p>Launch the grants process without extra spreadsheet work.</p><p><strong>Scope:</strong></p><ul><li><p>Audit the intake flow</p></li><li><p>Ship the new submission form</p></li></ul><p><strong>Out of Scope:</strong></p><ul><li><p>Finance system changes</p></li></ul><p><strong>Expected Outcomes:</strong></p><ol><li><p>Reduce intake handoff time</p></li><li><p>Give board members a cleaner review queue</p></li></ol><p><strong>Key feature:</strong></p><ul><li><p>Automated application triage</p></li><li><p>Board review dashboard</p></li><li><p>Status notifications</p></li></ul>",
      created_source: "starter_seed",
      starter_seed_key: "starter-project-1",
      starter_seed_version: 1,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
    }

    const details = buildMemberWorkspaceProjectDetails({
      project,
      tasks: [
        {
          id: "task-1",
          project_id: "project-1",
          title: "Define community partner list",
          description: null,
          priority: "no-priority",
          tag_label: null,
          workstream_name: null,
          task_type: "task",
          status: "in-progress",
          start_date: "2026-04-02",
          end_date: "2026-04-06",
          sort_order: 0,
        },
        {
          id: "task-2",
          project_id: "project-1",
          title: "Tighten eligibility criteria",
          description: null,
          priority: "no-priority",
          tag_label: null,
          workstream_name: null,
          task_type: "improvement",
          status: "todo",
          start_date: "2026-04-07",
          end_date: "2026-04-10",
          sort_order: 1,
        },
      ],
      notes: [
        {
          id: "note-1",
          title: "Kickoff summary",
          content: "Captured real project details from the partner call.",
          note_type: "general",
          status: "completed",
          created_at: "2026-04-02T09:30:00.000Z",
          created_by: "user-1",
          created_by_name: "Jason Duong",
          created_by_avatar_url: "https://example.com/jason.png",
        },
      ],
      quickLinks: [
        {
          id: "link-1",
          name: "Program brief",
          url: "https://example.com/program-brief.pdf",
          link_type: "pdf",
          size_mb: 2.4,
        },
      ],
      assigneeOptions: [
        {
          id: "user-1",
          name: "Jason Duong",
          avatarUrl: "https://example.com/jason-member.png",
        },
      ],
    })

    expect(details.id).toBe("project-1")
    expect(details.source?.name).toBe("Neighborhood Grants Rollout")
    expect(details.description).toBe(
      "Launch the grants process without extra spreadsheet work."
    )
    expect(details.scope).toEqual({
      inScope: ["Audit the intake flow", "Ship the new submission form"],
      outOfScope: ["Finance system changes"],
    })
    expect(details.outcomes).toEqual([
      "Reduce intake handoff time",
      "Give board members a cleaner review queue",
    ])
    expect(details.keyFeatures).toEqual({
      p0: ["Automated application triage", "Board review dashboard"],
      p1: ["Status notifications"],
      p2: [],
    })
    expect(details.workstreams.map((group) => group.name)).toEqual([
      "Tasks",
      "Improvements",
    ])
    expect(details.timelineTasks).toHaveLength(2)
    expect(details.time.schedule).toBeNull()
    const scheduled = buildMemberWorkspaceProjectDetails({ project, tasks: [], scheduleAvailable: true, scheduleConfirmed: true, projectMembers: [{ id: "actual-owner", name: "Real Owner" }, { id: "actual-contributor", name: "Real Contributor" }] })
    expect(scheduled.time.schedule).toEqual({ startDate: project.start_date, endDate: project.end_date })
    expect(scheduled.time.scheduleAvailable).toBe(true)
    expect(scheduled.backlog.picLabel).toBe("Owner")
    expect(scheduled.backlog.picUsers.map((person) => person.id)).toEqual(["actual-owner"])
    expect(scheduled.backlog.supportUsers?.map((person) => person.id)).toEqual(["actual-contributor"])

    expect(details.backlog.statusLabel).toBe("Active")
    expect(details.meta.sprintLabel).toBe("Launch 3 weeks")
    expect(details.meta.locationLabel).toBeUndefined()
    expect(details.workstreams[0]?.tasks[0]?.assignee).toBeUndefined()
    expect(details.workstreams[0]?.tasks[0]?.description).toBeUndefined()
    expect(details.workstreams[0]?.tasks[0]?.priority).toBe("no-priority")
    expect(details.notes).toEqual([
      expect.objectContaining({
        id: "note-1",
        title: "Kickoff summary",
        noteType: "general",
        status: "completed",
        addedBy: expect.objectContaining({
          id: "user-1",
          name: "Jason Duong",
          avatarUrl: "https://example.com/jason.png",
        }),
      }),
    ])
    expect(details.backlog.picUsers).toEqual([
      expect.objectContaining({
        id: "user-1",
        name: "Jason Duong",
        avatarUrl: "https://example.com/jason-member.png",
      }),
    ])
    expect(details.quickLinks).toEqual([
      expect.objectContaining({
        id: "link-1",
        name: "Program brief",
        type: "pdf",
        sizeMB: 2.4,
        url: "https://example.com/program-brief.pdf",
      }),
    ])
  })

  it("maps persisted project assets into files without fabricating quick links", () => {
    const project: OrganizationProjectRecord = {
      id: "project-2",
      org_id: "org-1",
      canonical_org_id: null,
      project_kind: "standard",
      name: "Operations Readiness",
      status: "active",
      priority: "medium",
      progress: 40,
      start_date: "2026-04-03",
      end_date: "2026-04-23",
      client_name: "Coach House",
      type_label: "Ops",
      duration_label: "3 weeks",
      tags: [],
      member_labels: ["Paula", "Joel"],
      task_count: 0,
      description: null,
      created_source: "user",
      starter_seed_key: null,
      starter_seed_version: null,
      created_by: "user-2",
      updated_by: "user-2",
      created_at: "2026-04-03T00:00:00.000Z",
      updated_at: "2026-04-04T00:00:00.000Z",
    }

    const details = buildMemberWorkspaceProjectDetails({
      project,
      tasks: [],
      assets: [
        {
          id: "asset-1",
          project_id: "project-2",
          name: "Org Intake Packet.pdf",
          description: "Primary document",
          asset_type: "pdf",
          external_url: null,
          size_bytes: 3145728,
          created_at: "2026-04-04T10:00:00.000Z",
          created_by: "user-2",
          created_by_name: "Paula",
          created_by_avatar_url: "https://example.com/paula.png",
        },
        {
          id: "asset-2",
          project_id: "project-2",
          name: "Figma Board",
          description: null,
          asset_type: "fig",
          external_url: "https://figma.com/file/abc123",
          size_bytes: null,
          created_at: "2026-04-04T11:00:00.000Z",
          created_by: "user-3",
          created_by_name: "Joel",
          created_by_avatar_url: null,
        },
      ],
    })

    expect(details.files).toEqual([
      expect.objectContaining({
        id: "asset-1",
        name: "Org Intake Packet.pdf",
        type: "pdf",
        sizeMB: 3,
        description: "Primary document",
        isLinkAsset: false,
        addedBy: expect.objectContaining({
          id: "user-2",
          name: "Paula",
          avatarUrl: "https://example.com/paula.png",
        }),
      }),
      expect.objectContaining({
        id: "asset-2",
        name: "Figma Board",
        type: "fig",
        sizeMB: 0,
        url: "https://figma.com/file/abc123",
        isLinkAsset: true,
      }),
    ])
    expect(details.quickLinks).toEqual([])
  })

  it("uses the dedicated overview document as the rich detail source", () => {
    const project: OrganizationProjectRecord = {
      id: "project-overview-doc",
      org_id: "org-1",
      canonical_org_id: null,
      project_kind: "standard",
      name: "Overview Document Test",
      status: "active",
      priority: "medium",
      progress: 10,
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      client_name: "Coach House",
      type_label: "Product",
      duration_label: "4 weeks",
      tags: [],
      member_labels: [],
      task_count: 0,
      description: "Compact list summary only.",
      created_source: "user",
      starter_seed_key: null,
      starter_seed_version: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
    }

    const overviewDocument =
      "<p><strong>Goal:</strong></p><p>Preserve the full rich overview.</p><p><strong>Expected Outcomes:</strong></p><ul><li><p>Readable display mode</p></li></ul>"
    const details = buildMemberWorkspaceProjectDetails({
      project,
      tasks: [],
      overviewDocument: {
        id: "overview-doc-1",
        org_id: "org-1",
        project_id: "project-overview-doc",
        document_html: overviewDocument,
        document_text: "Goal:\n\nPreserve the full rich overview.",
        updated_at: "2026-04-03T00:00:00.000Z",
      },
    })

    expect(details.description).toBe("Preserve the full rich overview.")
    expect(details.overviewDocument).toBe(overviewDocument)
    expect(details.outcomes).toEqual(["Readable display mode"])
  })

  it("preserves persisted task ordering inside a workstream and carries end dates", () => {
    const project: OrganizationProjectRecord = {
      id: "project-3",
      org_id: "org-1",
      canonical_org_id: null,
      project_kind: "standard",
      name: "Member Workspace Refresh",
      status: "active",
      priority: "medium",
      progress: 30,
      start_date: "2026-04-01",
      end_date: "2026-04-30",
      client_name: "Coach House",
      type_label: "Product",
      duration_label: "4 weeks",
      tags: [],
      member_labels: ["Alex Rivera"],
      task_count: 2,
      description: "Inline editing rollout",
      created_source: "user",
      starter_seed_key: null,
      starter_seed_version: null,
      created_by: "user-1",
      updated_by: "user-1",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
    }

    const details = buildMemberWorkspaceProjectDetails({
      project,
      tasks: [
        {
          id: "task-b",
          project_id: "project-3",
          title: "Second by date, first by order",
          description: null,
          priority: "no-priority",
          tag_label: null,
          workstream_name: null,
          task_type: "task",
          status: "todo",
          start_date: "2026-04-20",
          end_date: "2026-04-22",
          sort_order: 0,
        },
        {
          id: "task-a",
          project_id: "project-3",
          title: "First by date, second by order",
          description: null,
          priority: "no-priority",
          tag_label: null,
          workstream_name: null,
          task_type: "task",
          status: "todo",
          start_date: "2026-04-05",
          end_date: "2026-04-06",
          sort_order: 1,
        },
      ],
      assigneeOptions: [
        {
          id: "user-1",
          name: "Alex Rivera",
          avatarUrl: null,
        },
      ],
    })

    expect(details.workstreams).toHaveLength(1)
    expect(details.workstreams[0]?.tasks.map((task) => task.id)).toEqual([
      "task-b",
      "task-a",
    ])
    expect(details.workstreams[0]?.tasks[0]?.endDate?.toISOString()).toContain(
      "2026-04-22"
    )
  })
})
