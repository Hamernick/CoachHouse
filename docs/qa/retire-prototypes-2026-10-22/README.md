# Canonical login review

Actual local production server, Next16.2.6 / Node22.13.0, October22. Desktop light and mobile dark captures were visually inspected. No horizontal overflow; mobile inputs/submit are44px, desktop36px. These are review artifacts, not Linux visual baselines or user appearance acceptance.

- [Desktop login](login-1280-light.png)
- [Mobile login](login-390-dark.png)
- [Measured layout](login-layout.json)

Eight production Chromium behavior tests pass in `tests/visual/public-shell.visual.spec.ts`: three homepage redirects, legacy confirmation/invitation login state, rejected-password recovery/mobile sizing, tester redirect, Resources sign-in and marketplace redirect. Password request was intercepted; no real login, account creation, email, provider mutation or production data write occurred.
