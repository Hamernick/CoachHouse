# React Grab Execution Contract

Use React Grab's stock selection and clipboard output. The October 21 user request
removed custom ownership tags, selection redirection, clipboard transformers,
preview inspection hooks, debug registries and the OpenCode injection.

The root layout loads the exact installed React Grab version through the upstream
Next.js `beforeInteractive` script pattern, only in development. Production must
not load the inspector. Update the package and lockfile together; do not introduce
custom plugins or metadata without an explicit request.

When a user pastes a selection:

1. Read the selected element and component stack with source locations.
2. Trace the actual JSX, final class assembly and any shared style tokens.
3. Distinguish portal content from its trigger and tutorial previews from live UI.
4. If repeated shared components remain ambiguous, ask for visible text or a screenshot.

Do not infer semantic ownership from the closest wrapper. Do not change shared
primitive styles when the request targets only one use. Preserve normal product
behavior: display-only library previews stay inert.

`pnpm check:react-grab` guards the standard setup and prevents the removed custom
integration from being reintroduced.
