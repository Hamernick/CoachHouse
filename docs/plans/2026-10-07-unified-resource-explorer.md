# Connected resource discovery

The home surface is a search-driven explorer, not a chat interface. Keep one column and one persistent shell. Restore the existing top rail, an empty left rail (user-selected), and the rounded main canvas. The explorer lives inside that canvas. The search/Collected dock occupies a separate row below it, shortening the canvas without covering its content. The left rail becomes the existing sheet on mobile. The latest correction supersedes separate profile-page navigation.

- Discovery shows the framed map above a bounded category/guide/results panel. The top rail and search/Collected dock remain available throughout.
- Selecting a result, saved item or individual marker replaces the discovery area with its full organization/resource profile. The list and map are hidden while the profile is active. A short entrance transition respects reduced motion; no desktop split view.
- Native history updates the shareable profile URL without a route fetch or shell remount. Browser Back/Forward and the profile Back control restore selections and search context. Pending search URL updates are flushed before opening a profile. Existing collection state remains shared.
- Direct organization and directory profile links render the same home shell with the profile selected. The map is not initialized until discovery is requested; an existing map remains mounted during subsequent profile visits.
- Organization public handles and published legacy slug/ID fallbacks remain authoritative. Directory resources use /find/resources/<public UUID or EIN>. Private handles, unpublished records and ownership-read failures never fall through to another profile. Directory detail reads retain anonymous published projections, strict validation and five-minute public caching; IRS mailing addresses are not invented map pins.
- Standalone /map retains its existing drawer/rail, and person profiles retain their existing presentation.

No provider/schema/publication changes or deployment. Local review on localhost:3000. Focused checks cover route resolution and existing publication boundaries. Browser checks cover persistent shell/map identity, profile-only content, history, direct links, search and mobile overflow.
