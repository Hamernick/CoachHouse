import { useEffect, useState } from "react"
import { Button } from "../../../src/components/ui/button"
import { OrganizationFormBuilder } from "../../../src/features/organization-forms/client"
import { formDefinitionSchema, type FormDefinition } from "../../../src/features/organization-forms"

const initial: FormDefinition = { questions: [
  { id: "00000000-0000-4000-8000-000000000091", type: "single_choice", label: "Location", required: true, options: ["North", "South"] },
  { id: "00000000-0000-4000-8000-000000000092", type: "date", label: "Day", required: true },
  { id: "00000000-0000-4000-8000-000000000093", type: "time", label: "Time", required: true },
] }

/** Real controls; host save/reopen is an explicitly local serialized-draft fixture. */
export function FormControlsFixture() {
  const [locked, setLocked] = useState(false)
  useEffect(() => {
    const lock = () => setLocked(true)
    window.addEventListener("fixture-lock-form", lock)
    return () => window.removeEventListener("fixture-lock-form", lock)
  }, [])
  const [definition, setDefinition] = useState(initial)
  const [saved, setSaved] = useState(JSON.stringify(initial))
  const [generation, setGeneration] = useState(0)
  const [saveCount, setSaveCount] = useState(0)
  return <main className="mx-auto max-w-lg bg-background p-3 text-foreground">
    <p>Local form controls fixture</p>
    <form onSubmit={event => {
      event.preventDefault()
      setSaved(JSON.stringify(formDefinitionSchema.parse(definition)))
      setSaveCount(count => count + 1)
    }}>
      <OrganizationFormBuilder key={generation} definition={definition} disabled={locked} onChange={setDefinition} />
      <Button className="h-auto min-h-9 max-w-full whitespace-normal" type="submit">Save draft</Button>
    </form>
    <Button className="h-auto min-h-9 max-w-full whitespace-normal" type="button" onClick={() => {
      setDefinition(formDefinitionSchema.parse(JSON.parse(saved)))
      setGeneration(value => value + 1)
    }}>Reopen draft</Button>
    <Button className="h-auto min-h-9 max-w-full whitespace-normal" type="button" onClick={() => setLocked(value => !value)}>Toggle editing lock</Button>
    <output aria-label="Current definition" className="sr-only">{JSON.stringify(definition)}</output>
    <output aria-label="Draft saves">{saveCount}</output>
  </main>
}
