# GetANNY 2.0.0-rc.1 — Windows release candidate

A functional repair and cohesive desktop redesign, not just a screenshot reskin.

## Repaired

- Reliable queued HTTP/HTTPS transfers with verified parallel ranges, entity-aware continuation, hash-tested large-file transfer, awaited pause/cancel, collision-safe filenames, bounded retries and honest failures.
- SQLite metadata migration / restart recovery and a single event contract that keeps real jobs visible in the renderer.
- Persistent, manageable yt-dlp jobs, playable video/audio format selection, machine-readable progress and bundled FFmpeg merging. Storyboard clutter removed. Unknown size and unreported audio stay unknown.
- Browser native-messaging permission, real executable launcher (instead of invalid manifest arguments), native-first responses, authenticated fallback and handshake-based status. “Folder prepared” is no longer “extension installed”.
- Real torrent lifecycle and validated preferences with actual behavioral consumers.
- Single window chrome, polished dark controls, searchable download library, status-specific actions, accessible dialogs, media workflow, browser onboarding and responsive settings.

## Delivery

- **GetANNY Setup.exe** and **GetANNY Setup.msi**.
- Targeted ZIP packages for Helium, Chrome, Chromium, Brave, Firefox, Vivaldi and Opera; Edge included additionally. Chromium builds reuse one implementation with correct target configuration; Firefox uses a separate manifest.
- Windows/browser instructions, SHA-256 checksums and an evidence archive. GitHub provides source ZIP/tar archives for the release tag.
- The publishing workflow requires successful backend/media/bridge tests and actual installed EXE/MSI / Chromium integration tests. Read the attached JSON reports; generating a package alone is not considered an installation test.

## Important limitations — not a fully certified final release

- Packages are unsigned unless the attached Authenticode report explicitly says Valid. No signing identity was supplied during development.
- Firefox ZIP is **unsigned development source**, not a Mozilla-signed production XPI. Regular Firefox permanent installation requires authorized signing. Chromium packages are unpacked developer-mode packages, not signed store CRXs or silently installed extensions. No extension-store update service is configured.
- Read the attached `browser-matrix/matrix.json` for individually executed browser results. Chromium success alone does not certify any branded browser. Available Helium, Brave, Vivaldi, Opera and Firefox binaries are exercised separately; unavailable downloads are explicitly unverified. Google Chrome / Edge require manual approval and individual verification.
- The Windows runner is not a pristine consumer VM; interactive wizard/shortcut/UAC flows, real cross-version v1 upgrades and clean-machine dependency checks remain manual.
- Local HTML5 / DASH media tests verify real extraction/download/merging but do not certify every live website, authenticated media, regional access, DRM or playlist support. DRM and playlist downloading are not provided.
- Per-download bandwidth / connection changes apply to new/resumed jobs. The limit is explicitly **per transfer**, not a misrepresented global limit.
- Multi-terabyte / disk-full / power-loss / high-DPI / multiple-user edge cases need broader field testing.

See [test matrix and manual gates](https://github.com/77worldd/GetANNY/blob/arena/9c64a2a0-getanny/docs/TESTING.md), [Windows instructions](https://github.com/77worldd/GetANNY/blob/arena/9c64a2a0-getanny/docs/INSTALL_WINDOWS.md), and [browser guides](https://github.com/77worldd/GetANNY/blob/arena/9c64a2a0-getanny/docs/BROWSERS.md). This release remains a **prerelease** until those gaps are resolved; it does not claim every original acceptance criterion is complete.
