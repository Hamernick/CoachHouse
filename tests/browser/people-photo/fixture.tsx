import { createRoot } from "react-dom/client"
import { useState } from "react"
import { Toaster } from "sonner"
import { CreatePersonDialog } from "@/components/people/create-person-dialog"
import "../../../src/app/globals.css"

function Fixture() {
  const [saved, setSaved] = useState(localStorage.getItem("saved-person") ?? "")
  return <main><CreatePersonDialog onSaved={() => setSaved(localStorage.getItem("saved-person") ?? "")} />
    <output aria-label="Saved person">{saved}</output><Toaster />
  </main>
}
createRoot(document.getElementById("root")!).render(<Fixture />)
