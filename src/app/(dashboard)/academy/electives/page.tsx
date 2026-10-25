import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Academy Electives",
  description: "Explore optional nonprofit academy electives.",
}


export default function ElectivesIndexPage() {
  return (
    <div className="px-4 lg:px-6">
      <Card className="bg-card/60">
        <CardHeader>
          <CardTitle>Optional Electives</CardTitle>
          <CardDescription>Select an elective from the sidebar.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">We’ll populate this index with elective summaries later.</p>
        </CardContent>
      </Card>
    </div>
  )
}

