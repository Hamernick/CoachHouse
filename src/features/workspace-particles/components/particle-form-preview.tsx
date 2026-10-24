"use client"

import { Empty } from "@/components/ui/empty"
import { FORM_QUESTION_LABELS, type FormDefinition } from "@/features/organization-forms"
import { useParticleSurface } from "./particle-surface"

export function ParticleFormPreview({ definition }: { definition: FormDefinition }) {
  const surface = useParticleSurface()
  const questions = definition.questions.slice(0, 3)
  return (
    <div {...surface()} className="flex min-w-0 flex-col gap-3">
      {questions.length === 0 ? (
        <Empty
          {...surface()}
          title="Create a custom form"
          description="Add questions and choose how people answer."
          className="min-h-28 gap-2 border-0 bg-transparent px-2 py-4 shadow-none"
        />
      ) : (
        <ol className="flex min-w-0 flex-col gap-3">
          {questions.map((question, index) => (
            <li key={question.id} className="flex min-w-0 items-start gap-2.5">
              <span className="text-muted-foreground pt-0.5 text-xs tabular-nums">{index + 1}.</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="line-clamp-2 text-sm break-words">{question.label || `Question ${index + 1}`}{question.required && <span aria-label="required"> *</span>}</p>
                <p className="text-muted-foreground text-xs">{FORM_QUESTION_LABELS[question.type]}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {definition.questions.length > 3 && <p className="text-muted-foreground text-xs">+{definition.questions.length - 3} more questions</p>}
    </div>
  )
}
