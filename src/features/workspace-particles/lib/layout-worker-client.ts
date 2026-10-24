import { z } from "zod"
import {
  particleIdSchema,
  particlePositionSchema,
  particleRevisionSchema,
} from "./particle-schema"
import type { ParticleResult } from "../types"
import type { ParticleLayout } from "./graph-layout"
import type { ParticleLayoutRequest, ParticleLayoutScene } from "./layout-scene"

export type ParticleWorkerRequest =
  | ({ kind: "layout" } & ParticleLayoutRequest)
  | { kind: "route"; scene: ParticleLayoutScene }
export type ParticleWorkerFactory = () => Worker
const routesSchema = z
  .array(
    z.strictObject({
      id: particleIdSchema,
      points: z.array(particlePositionSchema).min(2).max(2000),
    })
  )
  .max(2000)
const layoutSchema = z.strictObject({
  workspaceId: particleIdSchema,
  revision: particleRevisionSchema,
  measurementKey: z.string().max(1_000_000),
  nodes: z
    .array(
      z.strictObject({
        id: particleIdSchema,
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().positive().max(4000),
        height: z.number().positive().max(10000),
      })
    )
    .max(250),
  routes: routesSchema,
})
const failureSchema = z.strictObject({
  ok: z.literal(false),
  code: z.enum([
    "invalid",
    "conflict",
    "scope",
    "locked",
    "unsupported",
    "unavailable",
  ]),
  error: z.string().max(1000),
})
const createWorker = () =>
  new Worker(new URL("./particle-layout.worker.ts", import.meta.url), {
    type: "module",
  })

export function runParticleWorker(
  request: ParticleWorkerRequest & { kind: "layout" },
  signal: AbortSignal,
  factory?: ParticleWorkerFactory
): Promise<ParticleResult<ParticleLayout>>
export function runParticleWorker(
  request: ParticleWorkerRequest & { kind: "route" },
  signal: AbortSignal,
  factory?: ParticleWorkerFactory
): Promise<ParticleResult<ParticleLayout["routes"]>>
export function runParticleWorker(
  request: ParticleWorkerRequest,
  signal: AbortSignal,
  factory: ParticleWorkerFactory = createWorker
): Promise<ParticleResult<ParticleLayout | ParticleLayout["routes"]>> {
  return new Promise((resolve) => {
    let worker: Worker | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const finish = (
      result: ParticleResult<ParticleLayout | ParticleLayout["routes"]>
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal.removeEventListener("abort", cancel)
      worker?.terminate()
      resolve(result)
    }
    const fail = (error: string) =>
      finish({ ok: false, code: "unavailable", error })
    const cancel = () => fail("Layout cancelled.")
    if (signal.aborted) return cancel()
    try {
      worker = factory()
      signal.addEventListener("abort", cancel, { once: true })
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const schema =
          request.kind === "layout"
            ? z.union([
                failureSchema,
                z.strictObject({ ok: z.literal(true), value: layoutSchema }),
              ])
            : z.union([
                failureSchema,
                z.strictObject({ ok: z.literal(true), value: routesSchema }),
              ])
        const parsed = schema.safeParse(event.data)
        if (parsed.success) finish(parsed.data)
        else fail("Invalid layout result. Saved positions were not changed.")
      }
      worker.onerror = () =>
        fail(
          "Layout worker failed. Try again; saved positions were not changed."
        )
      worker.onmessageerror = () =>
        fail("Unable to read the layout result. Try again.")
      timer = setTimeout(
        () => fail("Layout timed out. Try arranging fewer Particles."),
        15000
      )
      worker.postMessage(request)
    } catch {
      fail("Layout worker is unavailable. Saved positions were not changed.")
    }
  })
}
