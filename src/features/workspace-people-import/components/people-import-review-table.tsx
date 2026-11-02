"use client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { useWorkspacePeopleImportController } from "../hooks/use-workspace-people-import-controller"
export function PeopleImportReviewTable({
  controller,
  limit,
  onMore,
}: {
  controller: ReturnType<typeof useWorkspacePeopleImportController>
  limit: number
  onMore: () => void
}) {
  const { preview, pending } = controller
  return (
    <>
      <Table aria-label="Contact import review">
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.entries.slice(0, limit).map((entry) => (
            <TableRow key={entry.row}>
              <TableCell className="max-w-56 whitespace-normal">
                <p className="font-medium">
                  {entry.name || `Row ${entry.row}`}
                </p>
                <p className="text-muted-foreground text-xs break-all">
                  {controller.source &&
                    controller.source.rows[entry.row - 1]?.[
                      controller.source.headers.indexOf(
                        controller.mapping.email
                      )
                    ]}
                </p>
              </TableCell>
              <TableCell className="max-w-52 text-xs whitespace-normal">
                {entry.reason}
              </TableCell>
              <TableCell>
                <Select
                  disabled={pending || entry.outcome === "invalid"}
                  value={
                    controller.decisions[entry.row]?.kind === "merge"
                      ? `merge:${controller.decisions[entry.row].targetId}`
                      : (controller.decisions[entry.row]?.kind ?? "auto")
                  }
                  onValueChange={(value) =>
                    controller.setDecisions({
                      ...controller.decisions,
                      [entry.row]: value.startsWith("merge:")
                        ? {
                            kind: "merge",
                            targetId: value.slice(6),
                          }
                        : {
                            kind: value as "auto" | "add" | "skip",
                          },
                    })
                  }
                >
                  <SelectTrigger
                    aria-label={`Import action for row ${entry.row}`}
                    className="w-36"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic</SelectItem>
                    <SelectItem value="skip">Skip</SelectItem>
                    {entry.allowAdd && (
                      <SelectItem value="add">Add as new</SelectItem>
                    )}
                    {entry.candidates.map((candidate) => (
                      <SelectItem
                        key={candidate.id}
                        value={`merge:${candidate.id}`}
                      >
                        Fill {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview.entries.length > limit && (
        <Button variant="ghost" onClick={onMore}>
          Show more ({preview.entries.length - limit})
        </Button>
      )}
    </>
  )
}
