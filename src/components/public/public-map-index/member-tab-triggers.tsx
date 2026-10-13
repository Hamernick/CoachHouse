import { TabsTrigger } from "@/components/ui/tabs"

import { PublicMapCollectedTabLabel } from "./collected-tab-label"

export function PublicMapMemberTabTriggers({
  hasDirectory,
  hasGuides,
  className,
  collectedCount,
}: {
  hasDirectory: boolean
  hasGuides: boolean
  className: string
  collectedCount: number
}) {
  return (
    <>
      {hasDirectory ? (
        <TabsTrigger value="directory" className={className}>
          <span className="truncate">Find</span>
        </TabsTrigger>
      ) : null}
      {hasGuides ? (
        <TabsTrigger value="guides" className={className}>
          <span className="truncate">Guides</span>
        </TabsTrigger>
      ) : null}
      <TabsTrigger value="saved" className={className}>
        <PublicMapCollectedTabLabel count={collectedCount} />
      </TabsTrigger>
    </>
  )
}
