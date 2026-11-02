import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { ScrollFadeEffect } from "@/components/scroll-fade-effect"
import "@/app/globals.css"

function Fixture() {
  const [enabled, setEnabled] = useState(true)
  return <>
    <button onClick={() => setEnabled(!enabled)}>Toggle fades</button>
    <ScrollFadeEffect id="vertical" enabled={enabled} style={{ height: 120, width: 240 }}>
      <div id="rows">{Array.from({ length: 12 }, (_, i) => <div key={i} style={{ height: 30 }}>Row {i + 1}</div>)}</div>
    </ScrollFadeEffect>
    <ScrollFadeEffect id="short" style={{ height: 120, width: 240 }}><div>Complete list</div></ScrollFadeEffect>
    <ScrollFadeEffect id="horizontal" orientation="horizontal" style={{ width: 240, height: 80 }}>
      <div style={{ width: 720 }}>Left to right</div>
    </ScrollFadeEffect>
    <ScrollFadeEffect id="rtl" dir="rtl" orientation="horizontal" style={{ width: 240, height: 80 }}>
      <div style={{ width: 720 }}>Right to left</div>
    </ScrollFadeEffect>
    <ScrollFadeEffect id="outer" style={{ height: 120, width: 240 }}>
      <div style={{ height: 360 }}><ScrollFadeEffect id="inner" style={{ height: 60 }}>Nested complete list</ScrollFadeEffect></div>
    </ScrollFadeEffect>
    <ScrollFadeEffect id="focus" tabIndex={0} style={{ height: 120, width: 240 }}>
      <input aria-label="First field" /><div style={{ height: 360 }}>More</div>
    </ScrollFadeEffect>
    <div id="unmanaged" className="scroll-fade-effect-y" style={{ height: 120, overflow: "auto" }}><div style={{ height: 360 }}>No measurement</div></div>
  </>
}

createRoot(document.getElementById("root")!).render(<StrictMode><Fixture /></StrictMode>)
