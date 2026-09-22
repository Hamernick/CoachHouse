# About us tab behavior fixture

Run `node docs/qa/organization-story-tabs/run-fixture.mjs`, open http://127.0.0.1:3043/ in the authorized Bandto browser, then stop the process after review. This is an isolated static bundle, not a Next server.

The fixture uses the actual StoryPreview, StorySection rich-text editors and shared selection provider. Save and Cancel only modify fixture memory. No credentials are loaded; provider actions are not used. The server-only marker is stubbed for this standalone bundle. Its small CSS is for behavior checks; visual acceptance uses hosted Preview with actual application styles.

Verified September 14, 2026:

- Exactly one narrative panel exposed; the others are hidden and inert.
- Headings, emphasis and lists render with formatting.
- Mission selected in view remains selected upon Edit.
- Editing Mission, switching to Vision and back retains the draft.
- Cancel restores saved fixture text. Save fixture displays the updated rich text.
- ArrowRight moves from Origin story to Need.
- Focus theory selects Theory of change in Edit.
- Validate mission opens and focuses Mission, including repeated validation after switching away.
- Switching tabs remains possible while a validation message exists.

Validation focus initially ran before the newly selected panel was visible. The final implementation waits for that panel's React commit before focusing it.

The fixture also checks simultaneous Mission/Vision errors: correcting Mission retains its tab and focus, and typing in Values does not jump to Vision. Only a new explicit validation attempt opens the invalid field.
