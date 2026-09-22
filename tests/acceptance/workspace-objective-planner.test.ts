import { describe, expect, it } from "vitest"

import {
  chooseObjectiveDecision,
  completeDecisionAction,
  objectivePlanParts,
  saveObjectiveDraft,
  setObjectiveStepComplete,
} from "@/features/workspace-objective-planner/client"

describe("workspace objective planner", () => {
  it("builds an objective, decision branches, and shared actions", () => {
    const plan = saveObjectiveDraft(
      {
        title: "Launch a neighborhood training program",
        summary: "Start with one practical cohort.",
        decision: {
          question: "Do we have a confirmed training space?",
          yesAction: "Schedule the first cohort",
          noAction: "Confirm a partner venue",
        },
        steps: ["Set the curriculum", "Recruit participants"],
        tools: ["Volunteer trainer"],
        channels: ["Partner newsletter"],
      },
      "plan-1",
      "manual"
    )

    expect(objectivePlanParts(plan)).toEqual([
      "objective",
      "decision",
      "yes",
      "no",
      "steps",
      "checklist",
      "tools",
      "social",
    ])
    expect(plan.decision).toMatchObject({
      choice: null,
      yesComplete: false,
      noComplete: false,
    })
    expect(plan.steps.map((step) => step.title)).toEqual([
      "Set the curriculum",
      "Recruit participants",
    ])
  })

  it("tracks the selected decision, branch action, and shared step", () => {
    const plan = saveObjectiveDraft(
      {
        title: "Open registration",
        summary: "",
        decision: {
          question: "Is the venue confirmed?",
          yesAction: "Publish registration",
          noAction: "Secure the venue",
        },
        steps: ["Notify partners"],
        tools: [],
        channels: [],
      },
      "plan-2",
      "manual"
    )
    const chosen = chooseObjectiveDecision(plan, "yes")
    const branchComplete = completeDecisionAction(chosen, "yes", true)
    const complete = setObjectiveStepComplete(
      branchComplete,
      plan.steps[0]!.id,
      true
    )

    expect(complete.decision).toMatchObject({
      choice: "yes",
      yesComplete: true,
      noComplete: false,
    })
    expect(complete.steps[0]?.complete).toBe(true)
  })

  it("requires both decision outcomes before saving", () => {
    expect(() =>
      saveObjectiveDraft(
        {
          title: "Choose a venue",
          summary: "",
          decision: {
            question: "Is the library available?",
            yesAction: "Reserve it",
            noAction: "",
          },
          steps: [],
          tools: [],
          channels: [],
        },
        "plan-3",
        "manual"
      )
    ).toThrow("both possible actions")
  })
})
