import { summarizeWorkspaceEditors } from "@/components/workspace/workspace-editor-status"
import { saveProgramBeforeClose } from "@/components/programs/program-wizard/save-before-close"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { createEmbeddedPlaybackSession } from "@/components/media/embed-playback"
import {
  getEmbedProvider,
  prepareEmbedUrl,
} from "@/components/media/embed-provider"
import { ManagedVideoEmbed } from "@/components/media/managed-video-embed"
import { MediaActivityProvider } from "@/components/media/media-activity"
import { resolveRetainedDrawerRequest } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-retained-panel"
import type { WorkspaceDataDrawerRequest } from "@/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/workspace-canvas-overlay-drawer-tabs"

describe("retained media lifecycle", () => {
  it("pauses a player that becomes ready after its panel is hidden", () => {
    const pause = vi.fn()
    const session = createEmbeddedPlaybackSession(vi.fn())
    session.setActive(false)
    session.ready({ pause, dispose: vi.fn() })
    expect(pause).toHaveBeenCalledOnce()
    session.playing()
    expect(pause).toHaveBeenCalledTimes(2)
  })
  it("preserves the player on hide and never starts playback on restore", () => {
    const control = { pause: vi.fn(), dispose: vi.fn() }
    const session = createEmbeddedPlaybackSession(vi.fn())
    session.ready(control)
    session.setActive(false)
    session.setActive(true)
    expect(control.pause).toHaveBeenCalledOnce()
    expect(control.dispose).not.toHaveBeenCalled()
    session.dispose()
    session.dispose()
    expect(control.dispose).toHaveBeenCalledOnce()
  })
  it("disposes a late player after lesson replacement or unmount", () => {
    const control = { pause: vi.fn(), dispose: vi.fn() }
    const session = createEmbeddedPlaybackSession(vi.fn())
    session.dispose()
    session.ready(control)
    expect(control.dispose).toHaveBeenCalledOnce()
    expect(control.pause).not.toHaveBeenCalled()
  })
  it("falls back on pause failure without an unhandled rejection", async () => {
    const failed = vi.fn()
    const session = createEmbeddedPlaybackSession(failed)
    session.ready({
      pause: () => Promise.reject(new Error("unavailable")),
      dispose: vi.fn(),
    })
    session.setActive(false)
    await Promise.resolve()
    expect(failed).toHaveBeenCalledOnce()
  })
  it("ignores a late pause failure from an obsolete session", async () => {
    let rejectPause: (error: Error) => void = () => {}
    const failed = vi.fn()
    const session = createEmbeddedPlaybackSession(failed)
    session.ready({
      pause: () =>
        new Promise<void>((_, reject) => {
          rejectPause = reject
        }),
      dispose: vi.fn(),
    })
    session.setActive(false)
    session.dispose()
    rejectPause(new Error("late"))
    await Promise.resolve()
    expect(failed).not.toHaveBeenCalled()
  })
})

describe("provider boundaries and retained rendering", () => {
  it.each([
    ["https://www.youtube.com/embed/abc", "youtube"],
    ["https://www.youtube-nocookie.com/embed/abc", "youtube"],
    ["https://player.vimeo.com/video/123?h=private", "vimeo"],
    ["https://youtube.com.evil.test/embed/abc", "external"],
    ["https://evil.test/youtube.com/embed/abc", "external"],
    ["https://www.youtube.com:444/embed/abc", "external"],
    ["http://www.youtube.com/embed/abc", "external"],
    ["https://www.loom.com/embed/abc", "external"],
    ["not a url", "external"],
  ])("classifies %s as %s", (src, provider) => {
    expect(getEmbedProvider(src)).toBe(provider)
  })
  it("enables YouTube control with the real origin and preserves playback parameters", () => {
    const url = new URL(
      prepareEmbedUrl(
        "https://www.youtube-nocookie.com/embed/abc?start=40&autoplay=1",
        "http://localhost:3008"
      )
    )
    expect(url.origin).toBe("https://www.youtube-nocookie.com")
    expect(url.searchParams.get("origin")).toBe("http://localhost:3008")
    expect(url.searchParams.get("enablejsapi")).toBe("1")
    expect(url.searchParams.get("start")).toBe("40")
    expect(url.searchParams.get("autoplay")).toBe("0")
    const vimeo = new URL(
      prepareEmbedUrl(
        "https://player.vimeo.com/video/123?h=private",
        "http://localhost:3008"
      )
    )
    expect(vimeo.searchParams.get("h")).toBe("private")
    expect(vimeo.searchParams.get("origin")).toBeNull()
  })
  it("unloads an unsupported embed when hidden, including through nested active providers", () => {
    const html = renderToStaticMarkup(
      createElement(
        MediaActivityProvider,
        { active: false },
        createElement(
          MediaActivityProvider,
          { active: true },
          createElement(ManagedVideoEmbed, {
            src: "https://www.loom.com/embed/abc",
            title: "Lesson",
          })
        )
      )
    )
    expect(html).not.toContain("<iframe")
    expect(html).toContain("Load video")
    expect(html).not.toContain("loom.com")
  })
  it("starts known-provider rendering with an accessible loading state", () => {
    const html = renderToStaticMarkup(
      createElement(ManagedVideoEmbed, {
        src: "https://www.youtube.com/embed/abc",
        title: "Lesson",
      })
    )
    expect(html).toContain('role="status"')
    expect(html).not.toContain("<iframe")
  })
})

describe("retained drawer destinations", () => {
  const editing: WorkspaceDataDrawerRequest = {
    id: 1,
    tab: "organization",
    organizationProgramId: "program-a",
    organizationProgramStep: 2,
  }
  const incoming: WorkspaceDataDrawerRequest = {
    id: 2,
    tab: "organization",
    organizationProgramId: "program-b",
    organizationProgramStep: 0,
  }
  it("holds the current program and step while its editor is open", () => {
    expect(resolveRetainedDrawerRequest(editing, incoming, false)).toBe(editing)
  })
  it("applies the latest destination after the editor closes", () => {
    const latest: WorkspaceDataDrawerRequest = {
      id: 3,
      tab: "organization",
      organizationFocus: "mission",
    }
    expect(resolveRetainedDrawerRequest(editing, incoming, false)).toBe(editing)
    expect(resolveRetainedDrawerRequest(editing, latest, true)).toBe(latest)
  })
  it("does not consume a hidden or rejected destination", () => {
    expect(resolveRetainedDrawerRequest(null, incoming, false)).toBeNull()
    expect(resolveRetainedDrawerRequest(editing, null, true)).toBe(editing)
  })
  it("preserves identity on rerender but accepts a repeated link with a new request ID", () => {
    expect(resolveRetainedDrawerRequest(editing, { ...editing }, true)).toBe(
      editing
    )
    const repeated = { ...editing, id: 4 }
    expect(resolveRetainedDrawerRequest(editing, repeated, true)).toBe(repeated)
  })
})

describe("official SDK loading", () => {
  function environment() {
    const scripts: Array<{
      src: string
      async: boolean
      remove: ReturnType<typeof vi.fn>
      addEventListener: (event: string, callback: () => void) => void
      events: Map<string, () => void>
    }> = []
    vi.stubGlobal("document", {
      createElement: () => {
        const events = new Map<string, () => void>()
        const script = {
          src: "",
          async: false,
          remove: vi.fn(),
          addEventListener: (event: string, callback: () => void) =>
            events.set(event, callback),
          events,
        }
        scripts.push(script)
        return script
      },
      head: { append: vi.fn() },
    })
    vi.stubGlobal("window", { setTimeout, clearTimeout })
    return scripts
  }
  it("shares YouTube loading and preserves an existing ready callback", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const scripts = environment()
    const previous = vi.fn()
    window.onYouTubeIframeAPIReady = previous
    try {
      const { loadYouTubeApi } = await import("@/components/media/embed-sdk")
      const first = loadYouTubeApi()
      expect(loadYouTubeApi()).toBe(first)
      expect(scripts).toHaveLength(1)
      expect(scripts[0].src).toBe("https://www.youtube.com/iframe_api")
      window.YT = { Player: vi.fn() }
      window.onYouTubeIframeAPIReady?.()
      expect(await first).toBe(window.YT)
      expect(previous).toHaveBeenCalledOnce()
      expect(window.onYouTubeIframeAPIReady).toBe(previous)
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
  it("allows retry after a script failure without keeping its timer", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const scripts = environment()
    try {
      const { loadVimeoApi } = await import("@/components/media/embed-sdk")
      const failed = expect(loadVimeoApi()).rejects.toThrow(
        "Vimeo controls unavailable"
      )
      scripts[0].events.get("error")?.()
      await failed
      expect(scripts[0].remove).toHaveBeenCalledOnce()
      expect(vi.getTimerCount()).toBe(0)
      const retried = loadVimeoApi()
      window.Vimeo = { Player: vi.fn() }
      scripts[1].events.get("load")?.()
      expect(await retried).toBe(window.Vimeo)
      expect(scripts).toHaveLength(2)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
  it("times out a blocked API and restores the previous YouTube hook", async () => {
    vi.resetModules()
    vi.useFakeTimers()
    const scripts = environment()
    const previous = vi.fn()
    window.onYouTubeIframeAPIReady = previous
    try {
      const { loadYouTubeApi } = await import("@/components/media/embed-sdk")
      const failed = expect(loadYouTubeApi()).rejects.toThrow(
        "YouTube controls unavailable"
      )
      await vi.advanceTimersByTimeAsync(12000)
      await failed
      expect(scripts[0].remove).toHaveBeenCalledOnce()
      expect(window.onYouTubeIframeAPIReady).toBe(previous)
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})

describe("program draft close", () => {
  it("keeps the editor open until the final save succeeds", async () => {
    let finish: (error: string | null) => void = () => {}
    const close = vi.fn()
    const saving = saveProgramBeforeClose({
      save: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
      getRevision: () => 2,
      close,
    })
    expect(close).not.toHaveBeenCalled()
    finish(null)
    expect(await saving).toEqual({ status: "closed" })
    expect(close).toHaveBeenCalledOnce()
  })
  it("retains the form on a rejected or thrown save", async () => {
    const close = vi.fn()
    for (const save of [
      async () => "Permission denied",
      async () => {
        throw new Error("network")
      },
    ]) {
      expect(
        await saveProgramBeforeClose({ save, getRevision: () => 1, close })
      ).toMatchObject({ status: "failed" })
    }
    expect(close).not.toHaveBeenCalled()
  })
  it("does not close over edits made during the save", async () => {
    let revision = 1
    const close = vi.fn()
    const result = await saveProgramBeforeClose({
      save: async () => {
        revision++
        return null
      },
      getRevision: () => revision,
      close,
    })
    expect(result).toEqual({ status: "changed" })
    expect(close).not.toHaveBeenCalled()
  })
})

describe("content window edit indicator", () => {
  it("starts quiet and does not claim unreported content is saved", () => {
    expect(summarizeWorkspaceEditors([])).toEqual({
      outstanding: false,
      state: "clean",
      text: "",
    })
  })
  it("keeps the indicator after one of several editors saves", () => {
    const reports = [
      { label: "Organization", dirty: false },
      { label: "Activity", dirty: true },
    ]
    expect(summarizeWorkspaceEditors(reports)).toEqual({
      outstanding: true,
      state: "dirty",
      text: "Unsaved changes: Activity",
    })
  })
  it("keeps acknowledged and newer edits distinct through saving", () => {
    expect(
      summarizeWorkspaceEditors([
        { label: "Activity", dirty: true, pending: true },
      ]).state
    ).toBe("saving")
    expect(
      summarizeWorkspaceEditors([
        { label: "Activity", dirty: true, pending: false },
      ]).state
    ).toBe("dirty")
    expect(
      summarizeWorkspaceEditors([
        { label: "Activity", dirty: false, pending: false },
      ]).outstanding
    ).toBe(false)
  })
  it("prioritizes a failed save over another editor still saving", () => {
    const status = summarizeWorkspaceEditors([
      { label: "Organization", dirty: true, error: true },
      { label: "Activity", dirty: true, pending: true },
    ])
    expect(status.state).toBe("error")
    expect(status.text).toBe("Changes need attention: Organization, Activity")
  })
  it("tracks an unmodified preset awaiting explicit add without claiming it was saved", () => {
    expect(
      summarizeWorkspaceEditors([{ label: "Event", dirty: false, draft: true }])
    ).toEqual({
      outstanding: true,
      state: "draft",
      text: "Not yet added: Event",
    })
  })
})
