"use client"

import { ParticleEmptyMessage } from "@/components/ui/particle-ui"
import { FORM_QUESTION_LABELS, type FormDefinition } from "@/features/organization-forms"
import { useParticleSurface } from "./particle-surface"

export function ParticleFormPreview({ definition, expanded = false }: { definition: FormDefinition; expanded?: boolean }) {
  const surface = useParticleSurface()
  const questions = expanded ? definition.questions : definition.questions.slice(0, 3)
  return (
    <div {...surface()} className="flex min-w-0 flex-col gap-3">
      {questions.length === 0 ? (
        <div {...surface()}><ParticleEmptyMessage className="particle-ui min-h-28 gap-2 border-0 bg-transparent px-2 py-4 shadow-none"><ParticleEmptyMessage.Title>Create a custom form</ParticleEmptyMessage.Title><ParticleEmptyMessage.Description>Add questions and choose how people answer.</ParticleEmptyMessage.Description></ParticleEmptyMessage></div>
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
      {!expanded && definition.questions.length > 3 && <p className="text-muted-foreground text-xs">+{definition.questions.length - 3} more questions</p>}
    </div>
  )
}
