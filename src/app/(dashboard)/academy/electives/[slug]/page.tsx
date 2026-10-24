import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Academy Elective",
  description: "View this optional nonprofit academy elective.",
}


type Params = { slug: string }

export default async function ElectivePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const title = slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ")

  return (
    <div className="px-4 lg:px-6">
      <Card className="bg-card/60">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Elective — content coming soon.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This page is a placeholder for the “{title}” elective.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

