# RUNLOG

Canonical index for implementation history and session continuation.

## Current log

- [2026-09](runlog/2026-09.md)

## Archive

- [2026-08](runlog/2026-08.md)
- [Legacy history through 2026-07-14](runlog/archive/legacy-through-2026-07-14.md)

## Agent protocol

1. Read `AGENTS.md`.
2. Read this index and the latest dated entries in the current log.
3. Read `docs/agent/open-work-index.md`.
4. Complete the [worktree checkpoint](agent/workflow-quality.md#new-chat-worktree-checkpoint) before selecting a work lane or changing files. Honor an already chosen branch strategy.
5. Append the session summary to the current monthly log, not this index.

This is the canonical startup sequence. Run it once per chat; a model switch or
resumption in the same chat reuses existing context. Reread only relevant sections
that changed or whose context is missing. Historical logs do not reopen work:
explicit user-confirmed closures override older entries, and the open-work index
records active lanes, preservation holds, and release gates.

When the month changes, create `docs/runlog/YYYY-MM.md` and update the current
link above in the same change. Never edit archived logs. References elsewhere to
updating `docs/RUNLOG.md` mean updating the current monthly log linked here.

Use `YYYY-MM-DD HH:MM TZ - summary` entries. Include changes, validation,
limitations, and the next continuation point when relevant.
