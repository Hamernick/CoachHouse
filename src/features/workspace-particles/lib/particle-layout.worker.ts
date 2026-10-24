import ELK, { type ELK as ElkInstance } from "elkjs/lib/elk-api"
import { layoutParticleScene, routeParticleScene } from "./layout-scene"
import type { ParticleWorkerRequest } from "./layout-worker-client"

self.addEventListener(
  "message",
  async (event: MessageEvent<ParticleWorkerRequest>) => {
    let elk: ElkInstance | undefined
    try {
      const request = event.data
      if (request.kind === "route") {
        self.postMessage(routeParticleScene(request.scene))
        return
      }
      // The bundled ELK fallback cannot be constructed inside a browser worker:
      // it installs a global message handler instead of exporting its Worker shim.
      // Use ELK's supported API/worker boundary; the coordinator owns its lifetime.
      elk = new ELK({
        workerFactory: () =>
          new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url), {
            type: "module",
          }),
      })
      const engine = elk
      self.postMessage(
        await layoutParticleScene(request, (graph) => engine.layout(graph))
      )
    } catch {
      self.postMessage({
        ok: false,
        code: "unavailable",
        error: "Unable to calculate layout. Saved positions were not changed.",
      })
    } finally {
      elk?.terminateWorker()
    }
  }
)
