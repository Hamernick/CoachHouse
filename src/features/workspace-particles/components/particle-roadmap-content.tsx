"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sanitizeHtml } from "@/lib/markdown/sanitize"
import type { RoadmapSection } from "@/lib/roadmap/types"

export function ParticleRoadmapContent({
  section,
}: {
  section: RoadmapSection
}) {
  const html = useMemo(() => sanitizeHtml(section.content), [section.content])
  const rows = section.budgetRows ?? []
  if (!section.content.trim() && !rows.length && !section.imageUrl)
    return (
      <p className="text-muted-foreground p-4 text-sm">
        This section is ready for your ideas.
      </p>
    )
  return (
    <div className="particle-rich-text p-4 text-sm leading-relaxed [overflow-wrap:anywhere] [&_a]:underline [&_h1]:mb-3 [&_h1]:text-xl [&_h2]:my-3 [&_h2]:text-lg [&_h3]:my-2 [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:w-full [&_ul]:list-disc">
      {section.imageUrl ? (
        // Preserve the original roadmap artwork, including its aspect ratio.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={section.imageUrl}
          alt={section.title}
          loading="lazy"
          className="mb-4 max-h-48 w-full object-contain"
        />
      ) : null}
      {/<\/?[a-z][\s\S]*>/i.test(section.content) ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {section.content}
        </ReactMarkdown>
      )}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit cost</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="font-medium">{row.category || "Expense"}</div>
                  <div className="text-muted-foreground text-xs">
                    {[row.description, row.costType]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </TableCell>
                <TableCell>
                  {[row.units, row.unit].filter(Boolean).join(" ")}
                </TableCell>
                <TableCell>{row.costPerUnit}</TableCell>
                <TableCell>{row.totalCost}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  )
}
