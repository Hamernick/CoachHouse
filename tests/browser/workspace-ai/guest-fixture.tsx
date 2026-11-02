import { GuestWorkspacePage } from "../../../src/features/workspace-sharing/components/guest-workspace-page"
import { shareId } from "./sharing-actions"
export function GuestFixture() {
  const params = new URLSearchParams(location.search)
  return <GuestWorkspacePage pageId={params.get("guest") || shareId(10)} invitationId={params.get("invite") ?? undefined} />
}
