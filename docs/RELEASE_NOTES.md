# GetANNY 2.1.1 — Workflow, interception and localization release

This release completes the download-manager workflows that were still rough around the edges, and adds a real multilingual interface.

## Browser interception now takes over

File downloads started in a supported browser are paused, handed to the desktop engine, queued and started automatically. The paused browser copy is erased only after GetANNY confirms it owns the transfer, so the browser does not keep downloading in parallel and you no longer need to find the download in GetANNY and press Start. Disconnects and service-worker restarts reconcile through persisted transfer IDs, and duplicates are rejected.

Media pages still open in Media studio because a format must be chosen. That is a deliberate choice, not an interception failure.

## Cleaner downloads

- Torrent output uses the torrent's real name, sanitized for Windows, instead of a UUID folder. Existing UUID-named folders are migrated when a torrent resumes.
- HTTP chunk and partial files are written to a private per-transfer work folder outside your download destination. Only the finished, verified file appears in the destination, and resume data is kept until the transfer completes or is cancelled.
- Clearing download history never removes downloaded files.

## Downloads and navigation

- Native multiple selection with Ctrl-click, Shift-click, select all, long-press on touch, and Escape to exit.
- Clear history offers selected items, completed downloads, failed downloads, or all history, with a confirmation that names the scope.
- A single Back control returns from a detail sheet or workspace subsection without reloading and preserves filters.

## Studio and Media

- The active link is shown in its own field with a subtle X button that clears the link and the related analysis state immediately.

## Languages

- Complete interface translations for English, Arabic, French and Spanish.
- Language switcher beside the theme control; changes apply immediately and persist.
- Arabic switches the interface to right-to-left, with browser metadata, URLs and file names kept left-to-right and readable.

The localization layer is centralized and falls back to English, so additional languages can be added without touching components. This release does **not** yet ship complete translations for every language on IDM's list; four locales are complete, and the remaining languages are future work rather than machine-translated placeholders.

## Branding

The floating video-page button now uses the official GetANNY eagle/shield mark and wordmark instead of a generic download glyph.

## Packages

Windows EXE (NSIS), MSI, portable build, eight browser packages, one complete Windows bundle ZIP, documentation and SHA-256 checksums.

**Unsigned:** no code-signing certificate was available. Verify checksums before running. Firefox packages are unsigned development ZIPs. Reload or reinstall the browser extension after updating so the automatic interception changes take effect.

## Verification

All 97 automated tests pass, including real yt-dlp/FFmpeg lifecycle tests, browser handoff and reconciliation tests, private temp storage, torrent naming migration, history scopes and settings migration. The renderer production build succeeds. Windows packages are assembled from freshly built output with verified ZIP contents and checksums.
