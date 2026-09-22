# Mobile navigation

Floating web navigation for the app shell, inspired by David Mokos's
[expo-glass-tabs](https://github.com/davidmokos/expo-glass-tabs) (MIT).
This is an original DOM/CSS implementation: Expo Router, native glass materials,
native haptics and Reanimated cannot run in the Next.js DOM renderer.

- Real Next links with current-page semantics and no speculative prefetch.
- Sliding selection and pointer scrubbing; navigate only on release inside bar.
- Passive scroll direction detection; all icons remain available when compact.
- Safe-area spacing, keyboard avoidance, reduced motion and opaque fallback.
- Shell owns route availability and contextual panel actions. No server writes.
