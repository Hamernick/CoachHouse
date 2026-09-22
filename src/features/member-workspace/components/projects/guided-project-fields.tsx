"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { GuidedProjectInput } from "../../lib/guided-project"
import type {
  MemberWorkspacePersonOption,
  MemberWorkspaceProjectOrganizationOption,
} from "../../types"

export function PersonSelect({
  label,
  value,
  people,
  onChange,
  optional = false,
}: {
  label: string
  value?: string
  people: MemberWorkspacePersonOption[]
  onChange: (id: string) => void
  optional?: boolean
}) {
  return (
    <Select
      value={value || (optional ? "unassigned" : "")}
      onValueChange={(id) => onChange(id === "unassigned" ? "" : id)}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {optional ? (
          <SelectItem value="unassigned">Unassigned</SelectItem>
        ) : null}
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>
            {person.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function GuidedProjectBasics({
  value,
  change,
  organizations,
}: {
  value: GuidedProjectInput
  change: (patch: Partial<GuidedProjectInput>) => void
  organizations: MemberWorkspaceProjectOrganizationOption[]
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Organization</Label>
        <Select
          value={value.organizationId}
          onValueChange={(organizationId) =>
            change({
              organizationId,
              ownerId: "",
              contributorIds: [],
              tasks: value.tasks.map((task) => ({
                ...task,
                assigneeId: undefined,
              })),
            })
          }
        >
          <SelectTrigger aria-label="Organization" className="w-full">
            <SelectValue placeholder="Choose organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.orgId} value={org.orgId}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guided-project-name">Project name</Label>
        <Input
          id="guided-project-name"
          value={value.name}
          maxLength={180}
          onChange={(e) => change({ name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="guided-project-start">Start date</Label>
          <Input
            id="guided-project-start"
            type="date"
            value={value.startDate}
            onChange={(e) => change({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guided-project-end">Due date</Label>
          <Input
            id="guided-project-end"
            type="date"
            min={value.startDate}
            value={value.endDate}
            onChange={(e) => change({ endDate: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guided-project-description">Overview</Label>
        <Textarea
          id="guided-project-description"
          value={value.description}
          onChange={(e) => change({ description: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guided-project-outcomes">Expected outcomes</Label>
        <Textarea
          id="guided-project-outcomes"
          placeholder="Deliverables or measurable targets…"
          value={value.outcomes}
          onChange={(e) => change({ outcomes: e.target.value })}
        />
      </div>
    </div>
  )
}

export function GuidedProjectPeopleTasks({
  value,
  change,
  people,
}: {
  value: GuidedProjectInput
  change: (patch: Partial<GuidedProjectInput>) => void
  people: MemberWorkspacePersonOption[]
}) {
  const editTask = (
    index: number,
    patch: Partial<GuidedProjectInput["tasks"][number]>
  ) =>
    change({
      tasks: value.tasks.map((task, i) =>
        i === index ? { ...task, ...patch } : task
      ),
    })
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Project owner</Label>
        <PersonSelect
          label="Project owner"
          value={value.ownerId}
          people={people}
          onChange={(ownerId) => change({ ownerId, contributorIds: value.contributorIds.filter((id) => id !== ownerId) })}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Team members</legend>
        {people
          .filter((person) => person.id !== value.ownerId)
          .map((person) => (
            <label key={person.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.contributorIds.includes(person.id)}
                onCheckedChange={(checked) =>
                  change({
                    contributorIds: checked
                      ? [...value.contributorIds, person.id]
                      : value.contributorIds.filter((id) => id !== person.id),
                  })
                }
              />
              {person.name}
            </label>
          ))}
      </fieldset>
      <p className="text-muted-foreground text-xs">
        Assignments identify responsibilities; organization access stays
        unchanged.
      </p>
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Tasks &amp; workstreams</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={value.tasks.length >= 50}
          onClick={() =>
            change({
              tasks: [
                ...value.tasks,
                {
                  title: "",
                  startDate: value.startDate,
                  endDate: value.endDate,
                  workstream: "General",
                  assigneeId: value.ownerId || undefined,
                },
              ],
            })
          }
        >
          Add task
        </Button>
      </div>
      {!value.tasks.length ? (
        <p className="text-muted-foreground text-sm">
          Add tasks to populate the workstream timeline.
        </p>
      ) : null}
      {value.tasks.map((task, index) => (
        <div key={index} className="space-y-2 border-t pt-3">
          <div className="flex gap-2">
            <Input
              aria-label={`Task ${index + 1} title`}
              placeholder="Task name…"
              value={task.title}
              onChange={(e) => editTask(index, { title: e.target.value })}
            />
            <Button
              variant="ghost"
              onClick={() =>
                change({ tasks: value.tasks.filter((_, i) => i !== index) })
              }
              aria-label={`Remove task ${index + 1}`}
            >
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label={`Task ${index + 1} workstream`}
              value={task.workstream}
              onChange={(e) => editTask(index, { workstream: e.target.value })}
            />
            <PersonSelect
              optional
              label={`Task ${index + 1} assignee`}
              value={task.assigneeId}
              people={people}
              onChange={(id) =>
                editTask(index, { assigneeId: id || undefined })
              }
            />
            <Input
              aria-label={`Task ${index + 1} start date`}
              type="date"
              min={value.startDate}
              max={value.endDate}
              value={task.startDate}
              onChange={(e) => editTask(index, { startDate: e.target.value })}
            />
            <Input
              aria-label={`Task ${index + 1} due date`}
              type="date"
              min={task.startDate}
              max={value.endDate}
              value={task.endDate}
              onChange={(e) => editTask(index, { endDate: e.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
