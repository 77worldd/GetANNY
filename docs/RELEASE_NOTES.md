# GetANNY 2.0.0-rc.2 — Windows release candidate

A reliability, browser-handoff, media-workflow, appearance and source-backend performance upgrade. Existing HTTP, media, torrent, history and settings systems remain in place.

## Downloads and performance

- Replaced per-range worker threads with bounded asynchronous streams and adaptive range counts. One capability request replaces the old HEAD-plus-range sequence where possible; bounded keep-alive agents reuse connections.
- Batched renderer progress and SQLite persistence, reused prepared statements, reduced browser-detection polling, bounded media-analysis history and memoized download rows.
- Preserved exact range validation, entity-aware continuation, physical pause snapshots, atomic no-overwrite completion, cancellation cleanup, retries and optional per-transfer rate limiting. No new artificial speed limit is imposed.
- In the included local 128 MiB source-backend comparison (three fresh-process runs per variant), median throughput was **152.9 → 220.4 MiB/s**, transfer CPU **1452 → 806 ms**, peak RSS **210.8 → 103.9 MiB**, and ten full browser-status calls **46.8 → 12.1 ms**. All outputs were SHA-256 verified. These are local backend measurements, not public-network or installed-Electron claims. Short idle sampling remained near zero and did **not** demonstrate an idle-CPU reduction.

## Ordinary browser downloads

- Added Chromium/Firefox `downloads` integration for ordinary HTTP(S) files, including documents, archives, images, videos and unknown/large files.
- Native downloads pause before handoff. The extension forwards the final URL, available filename, URL-specific cookies, referer and browser user agent. Browser APIs do not expose every original request header.
- Desktop transfer IDs deduplicate acceptance and reconcile ambiguous timeouts/reconnections. Accepted native entries are cancelled and erased without requesting file deletion. Cleanup failure never deliberately resumes a second active copy.
- Definitive failures and dismissed reviews resume native. Short/unpausable and private/incognito downloads remain native. Reviewed transfers stay paused during temporary disconnection and are resumed on clean desktop shutdown.
- Reconnection uses bounded backoff. The compact media overlay is dismissible per video for the current page session.

## Media studio and library

- Added separate **Video & Audio, Thumbnails, Description, Tags and Subtitles** tabs using metadata legitimately returned by yt-dlp.
- Download accessible thumbnail renditions, full manual/automatic caption catalogs independently as VTT or SRT, or queue a separate subtitle alongside video. FFmpeg converts captions when the requested format is not directly available.
- Completed rows now include format, size, completion time and location, with open/reveal actions and lazy cached previews. OS thumbnails are preferred; bounded FFmpeg extraction is a fallback. Preview cache and IPC sizes are bounded, and full media files are not loaded into renderer memory.

## Appearance

- Added twelve coordinated dark, light and alternative palettes, system appearance, a dedicated Themes gallery and a compact top-left quick switcher.
- Renderer tests apply every palette and both system modes, checking text-token contrast of at least 4.5:1 on normal, raised and selected surfaces. This is not a complete accessibility certification.

## Delivery and verification

- **GetANNY Setup.exe** and **GetANNY Setup.msi**, plus targeted packages for Helium, Chrome, Chromium, Brave, Firefox, Vivaldi, Opera and Edge.
- The Windows workflow builds with pinned SHA-256-verified tools, runs the backend/media suites, installs and exercises both installer formats, checks lifecycle/history retention and runs available real-browser tests. Ordinary browser interception checks include cookie forwarding, desktop hash verification and native-entry cleanup.
- Read the appended `MEASURED_RESULTS.md`, source/run identity, SHA-256 sums and raw evidence for the actual result. A package being built or published is not by itself an installation or browser certification.

## Important limitations

- Packages are unsigned unless the attached Authenticode report explicitly says Valid. No signing identity was supplied.
- Firefox ZIP is unsigned development source, not a Mozilla-signed permanent XPI. Chromium packages use developer-mode installation, not signed store CRXs or silent installation. Store signing/update credentials are not configured.
- A Windows CI runner is not a pristine consumer VM. Interactive wizard/UAC choices, real cross-version v1 upgrades, multiple users, high-DPI/multiple monitors and assistive-technology review remain manual.
- Local HTML5/DASH/caption fixtures verify real extraction and output but do not certify YouTube or every live site, authenticated/region-restricted media, DRM or playlists. DRM and playlist downloading are not provided.
- Public-network performance, installed whole-desktop RAM/idle CPU, disk-full/power-loss, proxies, antivirus and real-world tracker behavior require broader field evidence.
- Per-download connection/rate changes apply to new/resumed jobs. The optional limit is per transfer, not a hidden global limit.

See [test evidence](https://github.com/77worldd/GetANNY/blob/arena/456bcab4-getanny/docs/TESTING.md), [Windows instructions](https://github.com/77worldd/GetANNY/blob/arena/456bcab4-getanny/docs/INSTALL_WINDOWS.md), and [browser guides](https://github.com/77worldd/GetANNY/blob/arena/456bcab4-getanny/docs/BROWSERS.md). This remains a **prerelease** until the attached verification gates and disclosed manual requirements are resolved.
