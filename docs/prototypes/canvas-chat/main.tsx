import { createRoot } from "react-dom/client"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ReactFlow, ReactFlowProvider, Background, useReactFlow, useViewport, type Node, type NodeProps } from "@xyflow/react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowUp, ArrowUpRight, ChevronDown, ChevronRight, CornerDownLeft, FileText, Flag, GripVertical, Layers, Maximize2, Minus, Moon, Plus, Sun, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { ParticleComposer } from "@/features/workspace-particles/components/particle-composer"
import { PlanningSidebarSurface } from "@/features/workspace-objectives/components/planning-sidebar-surface"
import { WorkspaceNodeFrameRoot, WorkspaceNodeFrameBody, WorkspaceNodeFrameHeader } from "@/components/workspace/workspace-node-frame"
import { edgeTarget, free, home, safeTransition, visibleFraction, type Point, type Rect } from "./geometry"
import { useFixture, type Preview } from "./use-fixture"
import "@xyflow/react/dist/style.css"
import "@/app/globals.css"
import "./prototype.css"

function PreviewCard({ preview, onAdd, added, draggable = false }: { preview: Preview; onAdd?: () => void; added?: boolean; draggable?: boolean }) {
  return <WorkspaceNodeFrameRoot className="prototype-card shadow-none" data-preview-id={preview.id}
    draggable={draggable && !added} onDragStart={event => { event.dataTransfer.setData("application/x-canvas-chat-preview", preview.id); event.dataTransfer.effectAllowed = "copy" }}>
    <WorkspaceNodeFrameHeader className="card-heading"><span>{preview.title}</span>{draggable && <GripVertical aria-label="Drag preview to canvas" className="size-4 shrink-0 text-muted-foreground" />}</WorkspaceNodeFrameHeader>
    <WorkspaceNodeFrameBody className="card-body"><ol>{preview.tasks.map(task => <li key={task}><span className="task-check" />{task}</li>)}</ol>
      {onAdd && <Button variant="outline" className="add-card" onClick={onAdd} disabled={added}>{added ? "Added to canvas" : "Add to canvas"}{!added && <ArrowUpRight className="size-4" />}</Button>}
    </WorkspaceNodeFrameBody>
  </WorkspaceNodeFrameRoot>
}
const nodeTypes = { preview: ({ data }: NodeProps<Node<{ preview: Preview }>>) => <PreviewCard preview={data.preview} /> }
const suggestions = [
  { title: "Turn an idea into a plan", detail: "Build a clear objective with practical next steps.", prompt: "Help us plan a community workshop", icon: Flag },
  { title: "Bring your documents together", detail: "Add context with + or @, then ask a question. This prototype uses fictional records.", prompt: "Use @ to add context to a plan", icon: FileText },
  { title: "Find the next step for your team", detail: "Start with a small decision, then move the result onto your canvas.", prompt: "Plan the next steps for our team", icon: Layers },
]

function Prototype() {
  const root = useRef<HTMLDivElement>(null), composer = useRef<HTMLDivElement>(null), thread = useRef<HTMLDivElement>(null)
  const fixture = useFixture(), flow = useReactFlow(), reduced = useReducedMotion()
  const [size, setSize] = useState({ x: window.innerWidth, y: window.innerHeight })
  const initial = { x: size.x / 2, y: size.y * .45, zoom: 1 }
  const viewport = useViewport()
  const [landing, setLanding] = useState(true)
  const [expanded, setExpanded] = useState(false), [windowOpen, setWindowOpen] = useState<string | null>(null), [dark, setDark] = useState(false)
  const [obstacles, setObstacles] = useState<Rect[]>([]), [suggestionIds, setSuggestionIds] = useState(suggestions.map((_, index) => index))
  const [nodes, setNodes] = useState<Node[]>([]), [offscreen, setOffscreen] = useState(false)
  const [chatHeight, setChatHeight] = useState(56), [returning, setReturning] = useState(false)
  const returnVersion = useRef(0), previous = useRef<Point | null>(null), [announcement, setAnnouncement] = useState("")
  const width = Math.min(700, size.x - 100), anchor = { x: viewport.x, y: viewport.y }
  const targetHome = landing ? { x: size.x / 2, y: size.y * .45 } : home(size)
  const away = Math.hypot(anchor.x - targetHome.x, anchor.y - targetHome.y) > 12
  const inline = { x: anchor.x + width / 2 + 27, y: anchor.y - chatHeight / 2 }
  const fraction = visibleFraction({ x: anchor.x - width / 2, y: anchor.y - chatHeight, width, height: chatHeight }, size)
  useEffect(() => { setOffscreen(old => fraction < (old ? .4 : .2) || !free({ x: inline.x, y: inline.y }, size, obstacles, old ? 18 : 10)) }, [fraction, inline.x, inline.y, size, obstacles])
  const destination = offscreen ? edgeTarget({ x: anchor.x, y: anchor.y - chatHeight / 2 }, size, obstacles, previous.current) : inline
  const animateTravel = destination && safeTransition(previous.current, destination, obstacles)
  useLayoutEffect(() => {
    const element = root.current!
    const measure = () => {
      const parent = element.getBoundingClientRect()
      setSize({ x: parent.width, y: parent.height })
      setObstacles([...element.querySelectorAll<HTMLElement>("[data-prototype-obstacle]")].map(el => {
        const r = el.getBoundingClientRect(); return { x: r.x - parent.x, y: r.y - parent.y, width: r.width, height: r.height }
      }))
      setChatHeight(composer.current?.getBoundingClientRect().height ?? 56)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (composer.current) observer.observe(composer.current)
    element.querySelectorAll("[data-prototype-obstacle]").forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [expanded, windowOpen, fixture.messages.length, landing])
  useEffect(() => { document.documentElement.classList.toggle("dark", dark) }, [dark])
  useEffect(() => {
    setNodes(fixture.cards.map(card => ({ id: card.id, type: "preview", position: card.position, data: { preview: card }, style: { width: 290 } })))
  }, [fixture.cards])
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: "instant" }) }, [fixture.messages.length, fixture.pending])
  const goHome = useCallback(async (focus = true) => {
    const version = ++returnVersion.current; setReturning(true); setLanding(false)
    await flow.setViewport({ ...home(size), zoom: viewport.zoom }, { duration: reduced ? 0 : 420 })
    if (version !== returnVersion.current) return
    setReturning(false); setAnnouncement("Returned to chat")
    if (focus) composer.current?.querySelector<HTMLElement>('[role="textbox"],textarea')?.focus({ preventScroll: true })
  }, [flow, size, viewport.zoom, reduced])
  const send = (text: string) => { fixture.send(text); if (landing) void goHome(false) }
  const add = (preview: Preview, position?: Point) => {
    const r = root.current!.getBoundingClientRect()
    fixture.add(preview, position ?? flow.screenToFlowPosition({ x: r.x + 24, y: r.y + 110 }))
  }
  const zoom = (factor: number) => void flow.zoomTo(Math.min(2, Math.max(.3, viewport.zoom * factor)), { duration: reduced ? 0 : 180 })
  const cancelReturn = (event: React.SyntheticEvent) => {
    if (returning && (event.target as HTMLElement).closest(".flow-surface")) {
      returnVersion.current++; setReturning(false); void flow.setViewport(flow.getViewport(), { duration: 0 })
    }
  }
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const id = event.dataTransfer.getData("application/x-canvas-chat-preview")
    const preview = fixture.messages.find(message => message.preview?.id === id)?.preview
    if (preview) add(preview, flow.screenToFlowPosition({ x: event.clientX - 145 * viewport.zoom, y: event.clientY - 20 * viewport.zoom }))
  }
  return <div ref={root} onWheelCapture={cancelReturn} onPointerDownCapture={cancelReturn} className={`prototype-root ${landing && !away ? "is-intro" : ""}`} data-testid="prototype" data-chat-state={offscreen ? "offscreen" : away ? "away" : "home"} data-returning={returning}>
    <div className="flow-surface" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy" }} onDrop={onDrop}>
      <ReactFlow nodes={nodes} nodeTypes={nodeTypes} defaultViewport={initial} minZoom={.3} maxZoom={2}
        onMoveStart={event => { if (event) { returnVersion.current++; setReturning(false) } }}
        onNodeDrag={(_, node) => setNodes(old => old.map(item => item.id === node.id ? node : item))}
        onNodeDragStop={(_, node) => fixture.move(node.id, node.position)} nodesConnectable={false} deleteKeyCode={null}
        panOnScroll selectionOnDrag={false} panOnDrag zoomOnDoubleClick={false} colorMode={dark ? "dark" : "light"} proOptions={{ hideAttribution: true }}>
        {(!landing || away) && <Background gap={24} size={1} color={dark ? "#505056" : "#c7c7cd"} />}
      </ReactFlow>
    </div>
    <div className="planning" data-prototype-obstacle>
      <PlanningSidebarSurface><Button variant="ghost" className="org-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><span className="org-avatar">CH</span><span>Coach House</span><ChevronDown className={`size-3 ${expanded ? "rotate-180" : ""}`} /></Button>
        {expanded && <div className="planning-detail"><div className="section-title">Objectives</div>{fixture.cards.length ? fixture.cards.map(card => <Button key={card.id} variant="ghost" className="planning-item" onClick={() => void flow.setCenter(card.position.x + 145, card.position.y + 100, { zoom: 1, duration: reduced ? 0 : 300 })}><Flag className="size-3.5" /><span>{card.title}</span></Button>) : <p>No objectives yet</p>}<div className="section-title">Opportunities</div><p>Your next idea starts here.</p></div>}
      </PlanningSidebarSurface>
    </div>
    <div className="prototype-tools material" data-prototype-obstacle><span>Prototype · simulated AI</span><Button aria-label={dark ? "Use light mode" : "Use dark mode"} title="Toggle theme" variant="ghost" size="icon" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button></div>
    <nav className="bottom-nav material" data-prototype-obstacle aria-label="Workspace tools">{["People", "Documents", "Tools"].map(label => <Button key={label} variant="ghost" aria-pressed={windowOpen === label} onClick={() => setWindowOpen(windowOpen === label ? null : label)}>{label}</Button>)}{away && !destination && <Button variant="ghost" onClick={() => void goHome()}>Return to chat</Button>}</nav>
    <div className="viewport-controls material" data-prototype-obstacle><Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => zoom(.8)}><Minus /></Button><span>{Math.round(viewport.zoom * 100)}%</span><Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => zoom(1.25)}><Plus /></Button><Button variant="ghost" size="icon" aria-label="Return home" onClick={() => void goHome()}><Maximize2 /></Button></div>
    {windowOpen && <section className="tool-window material" data-prototype-obstacle aria-label={`${windowOpen} window`}><header><span>{windowOpen}</span><Button variant="ghost" size="icon" aria-label="Close window" onClick={() => setWindowOpen(null)}><X /></Button></header><div className="window-content"><p>{windowOpen === "Documents" ? "Your shared documents" : windowOpen === "People" ? "Your team" : "Your workspace tools"}</p>{(windowOpen === "Documents" ? ["Our mission", "Community workshop notes", "Next quarter’s priorities"] : windowOpen === "People" ? ["Alex Morgan", "Jordan Lee"] : ["Plugins", "Particles"]).map(text => <div key={text} className="window-row"><FileText className="size-4" />{text}</div>)}<p className="fixture-note">Fixture window · tests indicator clearance</p></div></section>}
    <section className={`chat-anchor ${fixture.messages.length ? "has-conversation" : ""}`} style={{ width, transform: `translate(${anchor.x - width / 2}px, ${anchor.y - chatHeight}px)` }} aria-label="Canvas chat">
      <div className="above-composer">
        {fixture.messages.length ? <div ref={thread} className="conversation" role="log" aria-label="Conversation" tabIndex={0}>
          {fixture.messages.map(message => <div key={message.id} className={`message ${message.role}`}><p>{message.text}</p>{message.preview && <PreviewCard preview={message.preview} draggable onAdd={() => add(message.preview!)} added={fixture.cards.some(card => card.id === message.preview!.id)} />}</div>)}
          {fixture.pending && <p role="status" className="thinking">Building a starting point…</p>}
        </div> : <h1>Hey, Caleb. Ready to dive in?</h1>}
      </div>
      <div ref={composer} className="composer-zone"><ParticleComposer disabled={false} pending={false} error={null} saved={false} onRetry={() => {}} onCreate={async (_, title) => { send(title); return true }} onBrowse={query => { fixture.setDraft(`Help me create ${query.toLowerCase()}`); setWindowOpen(null) }}
        assistant={{ active: false, pending: fixture.pending, controls: null, submit: async () => false }}
        planner={{ active: false, input: fixture.draft, onInputChange: fixture.setDraft, context: fixture.context, submit: send }} /></div>
      {landing && !fixture.messages.length && <div className="suggestions">{suggestionIds.map(index => { const item = suggestions[index]; return <div className="suggestion-row" key={item.title}><HoverCard openDelay={250}><HoverCardTrigger asChild><Button variant="ghost" className="suggestion" onClick={() => fixture.setDraft(item.prompt)}><item.icon className="size-4 shrink-0" /><span>{item.title}</span><ArrowUpRight className="size-3.5 shrink-0" /></Button></HoverCardTrigger><HoverCardContent side="top" sideOffset={10} className="suggestion-preview">{item.detail}</HoverCardContent></HoverCard><Button variant="ghost" className="dismiss-suggestion" size="icon" aria-label={`Dismiss ${item.title}`} onClick={() => setSuggestionIds(ids => ids.filter(id => id !== index))}><X className="size-3.5" /></Button></div> })}</div>}
    </section>
    {away && destination && <motion.div className={`return-indicator ${offscreen ? "offscreen" : "inline"}`} initial={false} onUpdate={values => { previous.current = { x: Number(values.x) + 22, y: Number(values.y) + 22 } }} animate={{ x: destination.x - 22, y: destination.y - 22, opacity: 1 }} transition={{ duration: reduced || !animateTravel ? 0 : .1, ease: "linear" }} data-testid="return-indicator" data-mode={offscreen ? "edge" : "inline"}>
      <Button className="return-button" size="icon" title={offscreen ? "Chat is this way" : "Return to chat"} aria-label="Return to chat" onClick={() => void goHome()}>
        {offscreen ? <motion.span animate={{ rotate: Math.atan2(anchor.y - chatHeight / 2 - destination.y, anchor.x - destination.x) * 180 / Math.PI + 90 }} transition={{ duration: reduced ? 0 : .12 }}><ArrowUp className="size-5" /></motion.span> : <CornerDownLeft className="size-5" />}
      </Button>
    </motion.div>}
    <span className="sr-only" role="status">{announcement || fixture.notice}</span>
  </div>
}
createRoot(document.getElementById("root")!).render(<TooltipProvider><ReactFlowProvider><Prototype /></ReactFlowProvider></TooltipProvider>)
