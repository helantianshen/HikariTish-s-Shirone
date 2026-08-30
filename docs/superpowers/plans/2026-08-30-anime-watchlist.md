# Anime Watchlist Implementation Plan

**Goal:** Add the user's anime watchlist to Shirone with accurate statuses/progress and normalized local portrait covers.

## Tasks

1. Add regression coverage for the requested titles, statuses, progress, identity links, and local cover contract.
2. Download verified key visuals, convert them to 600x900 WebP, and store them under `public/assets/anime/covers/`.
3. Update `src/data/anime.ts`, preserving unrelated existing entries and replacing the existing Lycoris Recoil demo entry instead of duplicating it.
4. Update the anime page interaction tests for the expanded Chinese dataset.
5. Run focused Playwright tests, asset validation, Astro check, manifest validation, and update `.agent/HANDOFF.md`.

## Data decisions

- User-provided watch status and episode progress are authoritative, including `Re:Zero` season 4 at `14/14` while still marked watching and `Date A Live` at `9/13`.
- `Fate` is represented as `Fate 系列`, linked to `Fate/stay night [Unlimited Blade Works]`, until the user chooses a more specific route or season.
- New personal ratings remain `0` because the user did not provide ratings.
- Covers are local 2:3 WebP files at exactly 600x900 pixels.
