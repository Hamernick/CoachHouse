"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

// Temporary local diagnostic: preserve the React component stack before the
// route boundary receives only the error's JavaScript stack.
class FindRenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Find render component stack", info.componentStack)
    throw error
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function FindRenderDiagnostic({ children }: { children: ReactNode }) {
  return process.env.NODE_ENV === "development" ? (
    <FindRenderBoundary>{children}</FindRenderBoundary>
  ) : (
    children
  )
}
