import { hasPlatformCapability } from "@/features/platform-access"
import { resolveAuthenticatedAppContext } from "@/lib/auth/request-context"

// Personal staff tasks must not inherit the currently selected support workspace.
export async function resolveDirectoryTaskScope() {
  const { profileAudience } = await resolveAuthenticatedAppContext()
  return hasPlatformCapability(profileAudience.platformAccessLevel, "organizations")
    ? "platform" as const : "workspace" as const
}
