# Particle file previews

Continue the existing Particle lane and image aesthetic. User authorized PDF, Markdown, Word, CSV and canvas-filling previews, Motion transitions and lightweight loading. No generative UI or forms work.

1. Extend validated Activity widgets with private document references. Reuse Documents authorization/storage and the existing upload/history retry path. Preserve images and mixed file drops.
2. Add PDF, Markdown, DOCX, CSV and TXT previews. DOCX is a readable text preview, not a Word pagination engine. Legacy DOC is stored with an explicit conversion/download fallback. No external online document service receives private files.
3. Reuse PDF.js page controls; cap card raster resolution. Parse DOCX/CSV off-thread, bound text/table previews, terminate workers on timeout/unmount, load preview code only near the viewport.
4. Share one canvas-filling viewer with images. Reuse Radix focus trapping and Escape; return focus to the card action menu. Motion opacity/scale transitions use existing workspace easing and honor reduced motion. Keep title, close and original-file link compact; no shadow.
5. Validate schemas, upload routing, parsing limits and source integration; scoped TypeScript/lint and existing Particle regression tests. User handles visual interaction review.

Full-screen means the main canvas region, retaining application navigation outside it. File previews are read-only. Titles remain editable through existing inspector. Existing organization permissions and 15MB upload limit remain unchanged. Preview truncation is labeled and original files remain available.

References consulted: [Motion AnimatePresence](https://motion.dev/docs/react-animate-presence), [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion), [PDF.js examples](https://mozilla.github.io/pdf.js/examples/index.html), [Mammoth browser/text extraction](https://github.com/mwilliamson/mammoth.js), [Papa Parse documentation](https://www.papaparse.com/docs).

## Local verification

Implemented stages 1–4. 330 Particle tests passed; subsequent focused file/image/document-route/interaction-lock tests passed 52 tests. Scoped TypeScript and changed-file ESLint passed. Import boundaries, thresholds, React Grab, workspace storage/surfaces, interaction locks, acceptance manifest and raw-button checks passed. No database changes. Browser/appearance verification remains user-owned; no production release.

Additional bounds: card text renders at most 3,000 characters; expanded text at most 100,000. CSV mounts five rows in cards or forty expanded. Worker and fetch operations time out after fifteen seconds and are canceled when no longer needed.
