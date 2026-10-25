# Particle library-to-canvas placement motion

## Outcome

Drag a preset, saved Particle, or existing workspace tool from the Particles window onto the React Flow canvas. The lifted preview uses the existing renderer, including later design changes. Keep the visual language restrained: subtle lift/tilt, no new shadow, a short settle into the actual canvas card.

## Implementation steps

1. Add one shared pointer gesture and preview provider inside the existing workspace context boundary. Preserve external image/file and people native drops.
2. Use Motion values for pointer-following transforms. React state changes only at gesture start/end/placement status; movement must not update the graph, fetch, measure layout, or rerender the canvas. Motion batches style writes to animation frames.
3. Keep the source slot in place while dragging, dim it transiently, and reuse ParticleCard/WorkspaceBoardCard for the preview. List/icon views lift the full card. Preset preview data uses the same default factory fields as placement.
4. At release, validate the actual React Flow hit target and map the grabbed card origin through screenToFlowPosition. Create or place exactly once through existing validated/history-aware mutations. Publish a validated optimistic domain graph immediately; retain the confirmed graph for persistence and history.
5. Hold the preview only until the optimistic canvas card mounts. Hide only the incoming card during the bounded DOM handoff, measure that real node once, settle with a transform, then reveal it. Save confirmation runs independently; errors clear the projection and display a notice. Invalid drops, Escape, pointer cancellation, blur, or rejected saves restore the confirmed graph and library placement. Stable preset IDs allow safe retries.
6. Add a 44px touch grip, keeping card content available for vertical drawer scrolling. Existing plus controls provide keyboard placement. Respect reduced motion, announce placement/cancellation status, and clean pointer listeners, capture, transient opacity and animations on teardown.
7. Verify gesture thresholds, terminal-event idempotence, offset mapping, no intermediate writes, rejected saves, reduced motion, preset identity, explicit positions and existing Particle workflows with the current test infrastructure. Check types, lint and feature/ownership/size guardrails.

## Performance and review boundary

Target smooth 60fps tracking with transform/opacity animation, one preview, and no pointer-driven React renders. No physical-device frame-rate guarantee is claimed from unit/source checks. Browser automation remains excluded by the current lane instructions; user review should include mouse/touch drag, zoomed drop positions, cancellation, failure and both themes.

## References

- https://motion.dev/docs/react-motion-value
- https://motion.dev/docs/react-use-reduced-motion
- User-supplied Kanbaaan lifted-card screenshot.


## Instant-placement refinement

Local projection reuses `applyParticleBatch` validation; it does not introduce another store or write path. Confirmed records and Undo/Redo remain unchanged until a server receipt arrives. Creation and library placement opt into the projection; ordinary edits, layout, and history retain their existing behavior. Failed saves roll back, visibly report the failure, and reuse the batch/Particle IDs on retry. The drag layer hands off without awaiting the save, and settle duration is 90ms.
