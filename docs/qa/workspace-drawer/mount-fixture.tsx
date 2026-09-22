import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Drawer } from 'vaul'
import { useWorkspaceDrawerSnapPoints } from '../../../src/app/(dashboard)/my-organization/_components/workspace-board/workspace-canvas-v2/components/use-workspace-drawer-snap-points'

// Exercise a portal that becomes available after the root's snap effect.
// No application data, authentication, or provider requests are used.
function LateContent({ delay }: { delay: number }) {
  const [mounted, setMounted] = useState(delay === 0)
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  if (!mounted) return null
  return <Drawer.Portal><Drawer.Content
    aria-describedby={undefined}
    className="drawer"
  ><div data-fixture-header style={{ height: 32, overflow: 'hidden' }}><Drawer.Title style={{ margin: 0 }}>Drawer</Drawer.Title><Drawer.Handle /></div>
    <div data-fixture-content style={{ height: 36, overflow: 'hidden' }}>Visible drawer content</div>
  </Drawer.Content></Drawer.Portal>
}

function Case({ fixed, delay, initialHeight }: { fixed: boolean; delay: number; initialHeight: number }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const observedSnapPoints = useWorkspaceDrawerSnapPoints(fixed ? container : null)
  const [snap, setSnap] = useState<number | string | null>('68px')
  useEffect(() => {
    if (!container) return
    const timer = setTimeout(() => { container.style.height = '320px' }, 1000)
    return () => clearTimeout(timer)
  }, [container])
  return <section data-case={`${fixed ? 'fixed' : 'baseline'}-${delay}-${initialHeight}`}>
    <h2>{fixed ? 'Fixed' : 'Baseline'} / portal delay {delay}ms / initial height {initialHeight}px</h2>
    <div className="canvas" ref={setContainer} style={{ height: initialHeight }}>
      <Drawer.Root open={Boolean(container)} container={container ?? undefined}
        snapPoints={fixed ? observedSnapPoints : ['68px', 0.48, 1]} activeSnapPoint={snap} setActiveSnapPoint={setSnap}
        modal={false} dismissible={false} noBodyStyles handleOnly>
        {container ? <LateContent delay={delay} /> : null}
      </Drawer.Root>
    </div>
    <button onClick={() => setSnap('68px')}>Collapsed</button>
    <button onClick={() => setSnap(0.48)}>Half</button>
    <button onClick={() => setSnap(1)}>Full</button>
  </section>
}
function FocusCase({ clip }: { clip: boolean }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const target = useRef<HTMLButtonElement>(null)
  const snapPoints = useWorkspaceDrawerSnapPoints(container)
  return <section data-focus-case={clip ? 'clip' : 'hidden'}>
    <h2>Focus inside {clip ? 'clipped' : 'hidden'} frame</h2>
    <button onClick={() => target.current?.focus()}>Focus {clip ? 'clipped' : 'hidden'} frame field</button>
    <div className="canvas" ref={setContainer} style={{ height: 320, overflow: clip ? 'clip' : 'hidden' }}>
      <Drawer.Root open={Boolean(container)} container={container ?? undefined}
        snapPoints={snapPoints} activeSnapPoint="68px" modal={false} dismissible={false} noBodyStyles handleOnly>
        {container ? <Drawer.Portal><Drawer.Content aria-describedby={undefined} className="drawer">
          <Drawer.Title style={{ margin: 0, height: 32 }}>Drawer</Drawer.Title>
          <div data-fixture-focus-content style={{ height: 36 }}>Visible content</div>
          <button ref={target} style={{ marginTop: 160 }}>Detail field</button>
        </Drawer.Content></Drawer.Portal> : null}
      </Drawer.Root>
    </div>
  </section>
}

createRoot(document.getElementById('root')!).render(<><FocusCase clip={false} /><FocusCase clip />{[220,0].flatMap(initialHeight => [false,true].flatMap(fixed => [0,60].map(delay => <Case key={`${fixed}-${delay}-${initialHeight}`} fixed={fixed} delay={delay} initialHeight={initialHeight} />)))}</>)
