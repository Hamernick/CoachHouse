# Workspace drawer: bounded geometry regression

September 14, 2026. Profile branch, base `8673bcff`.

## Result

Delayed portal mounting alone rendered correctly. A container growing from
220px to 320px without a window resize left Vaul's collapsed translation at
152px: **168px visible instead of 68px**. Both immediate and 60ms delayed portals
failed. Vaul 1.1.2 observes window resize but does not observe its container.

The actual `useWorkspaceDrawerSnapPoints` source hook observes container height
and refreshes the snap-point array after changes. Both fixed cases measured
252px translation, **68px visible**. With the delayed portal, control transitions
also measured 153.6px (48%), 320px (full), and 68px (collapsed).

This proves and fixes stale container geometry. It does **not** establish that
container resizing caused the user's original hosted first-authenticated-load
failure. A fresh authenticated Bandto Preview tab at 8673bcff rendered correctly:
878px canvas, 810px translation, 68px visible, 36px inner viewport; sampled
error/warning logs were empty. First navigation's immediate inspection timed out;
measurements were taken after it settled, not frame-by-frame from first paint.

## Reproduce without Next

From this worktree:

```sh
node docs/qa/workspace-drawer/run-fixture.mjs
```

Open http://127.0.0.1:3043/ in the supported Chrome connection. Wait until the
canvases grow, then compare baseline and fixed cases. Use the final case's
Collapsed / Half / Full buttons to check transitions. The fixture uses installed
React and Vaul plus the actual fix hook, bundles approximately 259 KB, serves
only static assets on loopback, and uses no application/provider data. Stop with
Ctrl-C. It performs no Next build and starts no Next server.

Validation: targeted ESLint and all 11 existing drawer acceptance tests passed.
No intended design changes or baseline updates. Full quality/hosted cold-load
regression remains pending; no release approval. Graphify refresh deferred under
the user's laptop-resource restriction.

## September 15: zero-height startup regression

The fixture now covers initial container heights0 and220px, each with immediate
and60ms delayed portals, before growing to320px. It uses a32px header and36px
content marker to measure actual text visibility inside the clipped canvas.

| Initial height | Baseline translation / visible drawer / visible text | Fixed translation / visible drawer / visible text |
| --- | --- | --- |
|220px|152px /168px /16.5px|252px /68px /16.5px|
|0px|-68px /252px /0px|252px /68px /16.5px|

Both portal timings produce the same results. Zero-height startup reproduces
a large blank drawer: the text has moved above the clipped container. The existing
source hook restores the correct collapsed geometry and visible content. This
reproduces the failure class; it still does not prove that the historical Preview
incident began with a zero-height canvas. No additional source fix was necessary.

Fresh authenticated Bandto navigation at Profile2931f0d3 to
`/workspace?drawer=accelerator` rendered the Accelerator without dragging:330px
viewport,589px canvas,306.28px translation,282.72px visible (requested48%), mounted
lesson content and progress. The preceding plain Workspace navigation also
rendered its Organization panel correctly. These are fresh page mounts with
an existing authenticated browser, not a new account, cleared cache or first-frame
recording. Organization tab restored; the user has not yet rechecked the original
incident. Drawer completion remains95%.

The expanded fixture and64 Profile resource/drawer checks pass. The temporary
loopback fixture server is stopped. No extra Next server or full local build.

## September 15: prevent hidden canvas scrolling

A separate defect was reproduced on authenticated Profile51882a89. After
fullscreen/restore and selecting Organization, the drawer retained its correct
306.28px translation but the flow-frame ancestor had scrollTop36px. Consequently
the half drawer showed318.72px rather than282.72px in the589px canvas. The frame
uses overflow:hidden, which still permits focus/programmatic scrolling.

The fixture now includes two focus cases using the real Vaul component and
measurement hook. Focusing a control outside the collapsed viewport gives:

| Frame overflow | scrollTop | Visible drawer | Visible content marker |
| --- | --- | --- | --- |
|hidden|252px|320px (entire canvas)|36px|
|clip|0px|68px|35px (1px border clipped)|

This reproduces an incorrectly full-height drawer independently of cached snap
geometry. It does not reproduce the blank content in that focus case; zero-height
startup remains the separate reproduced blank-content failure. Change only the
flow-frame owner's overflow to clip. Nested content scrollers and React Flow's
transform-based panning remain in place. No control sizes, fonts or snap points
change. Normal localhost React Grab remains enabled.

Use the two Focus frame field buttons at the top of the existing fixture.
Supported browser text locators work on this minimal HTML page; role-name
locators did not resolve these fixture buttons. No source/database/provider data
is used. Hosted verification of the actual frame change follows.

[MDN overflow reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)
documents the hidden-versus-clip scrolling distinction.
Recovery: /var/folders/l2/jpghvb_52t10fnrzxcs0bpd40000gn/T/coach-house-drawer-focus-scroll-34wb28zo .

Local actual-component verification after fullscreen/restore and selecting
Organization:653px canvas,339.56px translation,313.44px visible (exact48%),
flow-frame scrollTop0 and overflow clip. Selecting the lower Need pill scrolls
only the nested content viewport to1045px; the frame remains at0. Restored Origin
story and the Organization panel. Eleven existing drawer acceptance tests,
focused lint and whitespace pass. Temporary3043 fixture server stopped;
existing root Next server on3000 stays running.
