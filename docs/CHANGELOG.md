# Changelog

## 2.1.3 — Workspace and tray refinement

- Consolidated download search, type filters, pause, sort and history actions into one compact toolbar. The sidebar now holds the single primary New download action.
- Removed redundant Back controls and marketing subtitles from primary pages; displayed the New download shortcut now matches the host operating system.
- Added the completed-download count to the persistent live status bar and removed duplicated transfer totals from each download view.
- Refined browser connection status, compacted settings controls, and rebuilt theme previews to show an application frame, list and status strip.
- Fixed tray interaction so a visible window hides on tray click, a hidden or minimized window restores on click or explicit Show, and OS activation does not undo close-to-tray.
- Quit now shuts down the desktop services and prevents a browser native-host reconnect from relaunching GetANNY; opening the app manually clears that stop state.
- Kept download, browser, settings and theme actions wired to their existing services and state.

## 2.1.2 — Setup, subtitles and interface polish

- The first-run browser setup is now remembered: a verified extension handshake marks setup complete and later launches open the download library directly. The setup screen only appears again when opened from the sidebar.
- YouTube and other captions now download from the analyzed track URL with retries, then convert VTT ↔ SRT locally, so subtitle downloads no longer depend on a second yt-dlp page scrape or FFmpeg post-processing.
- Fixed the duplicated, misaligned selection checkboxes: each row now owns a real checkbox column, the header select-all matches it, and the selection toolbar keeps its state.
- Rebuilt the Media link field: the clear button sits inside the input as a subtle inline control instead of a detached grey square.
- Moved Back out of the title bar into a sticky context bar, mirrored automatically for right-to-left layouts.
- Arabic layout fixes: mirrored switches, logical margins and borders, translated chevrons, right-aligned tab bars, LTR numbers, paths and progress tracks.
- Nordic is now the default theme for new installations, and the browser extension (popup and floating button) mirrors the desktop palette over the authenticated bridge.
- Performance: the app shell no longer subscribes to every download tick, inactive download tabs skip reconciling their rows, memoized row callbacks avoid needless re-renders and off-screen rows are layout-skipped.
- Fixed the Torrents section, which previously opened an empty workspace.

## 2.1.1 — Workflow, interception and localization release

- Studio and Media link fields show the active link with an inline clear (X) control that also resets analysis state.
- Downloads gained native multi-selection, batch removal, Escape to leave selection, and a scoped Clear history menu for selected, completed, failed or all history. History cleanup never deletes downloaded files.
- Every workspace subsection and download detail sheet now has one contextual Back control that preserves tab and filter state.
- Intercepted browser files are queued and started automatically; the paused browser copy is erased only after desktop ownership is confirmed.
- Torrent output uses the swarm metadata name instead of UUID folders, and legacy folders migrate on resume.
- Chunk and partial files live in a private per-transfer work directory outside the destination.
- Added centralized English, Arabic (RTL), French and Spanish localization with immediate switching and persistence.
- The floating video-page button uses the official GetANNY mark and wordmark.

## 2.1.0 — Obsidian identity release

- Adopted the official supplied eagle/shield mark and GetANNY wordmark unchanged. A reproducible generator rebuilds transparency, recolours and resamples the original artwork into a multi-resolution Windows ICO, ICNS, application/tray/notification PNGs, installer header and sidebar bitmaps, favicon and browser-extension icons.
- Branded the application shell, startup screen, About panel and browser-assistant popup; both the mark and lettering render as theme-aware masks so the original artwork is never redrawn or replaced.
- Rebuilt the palette catalogue around the monochrome identity: **Obsidian** and **Porcelain** are the logo-native dark/light defaults, High Contrast is pure monochrome, and the nine other palettes keep their character with restrained accents. Removed leftover mint-specific glows in favour of theme tokens.
- Added installer artwork for NSIS/MSI and updated the in-app repository link to the official `p4yy/GetANNY` repository.
- Bumped the application and all browser packages to 2.1.0. Distribution remains unsigned; Firefox packages remain unsigned development ZIPs.

## 2.0.0 — Windows release source

- Added a daily local-time start window for queued downloads, including overnight schedules and clean-restart persistence.
- Browser review locks the intercepted file link and verifies the matching desktop transfer before cancelling the browser copy.
- Reconciled Chromium handoffs after service-worker suspension using browser-session storage, and avoided browser download-ID reuse collisions and a disconnect race.
- Added browser cookie-store selection when the download exposes a store ID, foreground attention for automatically accepted handoffs, and an Open source action.
- Added standard, reduced and disabled motion modes; compacted page headings and moved Themes beside Settings.
- Added a portable Windows build target and a staged distribution ZIP with installer, extensions, native-host components and setup guides. Release assembly is gated on Windows tests and ZIP content verification.

Known limitations include incomplete localization and Arabic RTL, unsigned Firefox development packages, no native-host cold launch from the portable executable, and unverified consumer Windows/browser scenarios. See the release's measured evidence before treating a package as tested.

## 2.0.0-rc.2

Introduced ordinary browser handoff, an asynchronous range engine, media metadata and subtitles, additional themes, and installed-app verification tooling. The published binaries and their actual verification limits are documented on the rc.2 release page.
