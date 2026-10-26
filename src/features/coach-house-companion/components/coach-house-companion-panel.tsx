import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CoachHouseCompanionInput } from "../types"

type CoachHouseCompanionPanelProps = {
  input: CoachHouseCompanionInput
}

export function CoachHouseCompanionPanel({ input }: CoachHouseCompanionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>CoachHouseCompanion</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{input.id}</CardContent>
    </Card>
  )
}
