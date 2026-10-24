import type { Metadata } from "next"
import {
  MemberWorkspacePeoplePage,
  loadMemberWorkspacePeoplePage,
} from "@/features/member-workspace"

export const metadata: Metadata = {
  title: "People",
  description: "Manage the people connected to your workspace.",
}


export default async function PeoplePage() {
  const result = await loadMemberWorkspacePeoplePage()

  return <MemberWorkspacePeoplePage {...result} />
}
