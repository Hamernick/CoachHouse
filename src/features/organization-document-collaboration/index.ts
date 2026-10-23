import "server-only"

export { handleDocumentCollaborationPost, handleDocumentPresencePost, handleDocumentCapabilitiesGet } from "./routes"
export type { DocumentScope, DocumentVersion } from "./types"
