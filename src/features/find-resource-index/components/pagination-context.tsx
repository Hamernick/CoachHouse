"use client"

import { createContext, useContext } from "react"

export type ResourceDirectoryPagination = {
  totalCount?: number
  key: string
  hasMore: boolean
  loading: boolean
  error: string | null
  loadMore: () => Promise<boolean>
}
const ResourcePaginationContext = createContext<ResourceDirectoryPagination | null>(null)
export const ResourceDirectoryPaginationProvider = ResourcePaginationContext.Provider
export function useResourceDirectoryPagination() { return useContext(ResourcePaginationContext) }
