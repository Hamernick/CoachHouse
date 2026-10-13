import type {
  DocumentsLibraryFileType,
  DocumentsLibrarySource,
  DocumentsLibraryTab,
} from "./documents-library-grid"

export type DocumentsViewMode = "grid" | "list"

export type DocumentsToolbarProps = {
  searchQuery: string
  tab: DocumentsLibraryTab
  viewMode: DocumentsViewMode
  source: DocumentsLibrarySource
  fileType: DocumentsLibraryFileType
  showDeleted: boolean
  canUpload: boolean
  canEdit: boolean
  editMode: boolean
  driveConnected: boolean
  drivePending: boolean
  onSearchQueryChange: (value: string) => void
  onTabChange: (tab: DocumentsLibraryTab) => void
  onViewModeChange: (viewMode: DocumentsViewMode) => void
  onSourceChange: (source: DocumentsLibrarySource) => void
  onFileTypeChange: (fileType: DocumentsLibraryFileType) => void
  onShowDeletedChange: (showDeleted: boolean) => void
  onReset: () => void
  onUploadFiles: (files: File[]) => Promise<void>
  onGoogleDrive: () => void
}
