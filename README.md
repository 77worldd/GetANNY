# GetANNY

**Reliable downloads. Clear control.** A Windows-first Electron download manager with a React workspace, persistent SQLite history, verified HTTP range transfers, yt-dlp media downloads, and authenticated browser integration.

> **Current source: 2.0.0-rc.3.** This source includes scheduling, handoff-recovery and packaging work. A new Windows build is not a verified release until its installer, portable, browser and uninstall gates have actually passed. The existing rc.2 release predates these changes. See [testing evidence and remaining gates](docs/TESTING.md).

## Get the Windows app

### Previous public release candidate

The public [**GetANNY 2.0.0-rc.1 release**](https://github.com/77worldd/GetANNY/releases/tag/v2.0.0-rc.1) contains both real Windows installers, eight browser packages, guides, source provenance, verification status and SHA-256 checksums.

**Direct downloads:** [GetANNY Setup.exe](https://github.com/77worldd/GetANNY/releases/download/v2.0.0-rc.1/GetANNY.Setup.exe) · [GetANNY Setup.msi](https://github.com/77worldd/GetANNY/releases/download/v2.0.0-rc.1/GetANNY.Setup.msi) · [SHA256SUMS.txt](https://github.com/77worldd/GetANNY/releases/download/v2.0.0-rc.1/SHA256SUMS.txt).

These are the same unsigned binaries built from `048d137`, now hosted as a real public prerelease—not a new build or a certification. At publication, installed-app/browser verification was still incomplete. Use **one installer format**, not both simultaneously. Windows 10/11 x64 is required.

- EXE: interactive per-user installer, installation-folder selection, Start Menu and optional desktop shortcut.
- MSI: Windows Installer package for interactive or scripted deployment; optional desktop shortcut.
- Both include the renderer, SQLite native module, asynchronous HTTP range engine, yt-dlp, FFmpeg/ffprobe, a compiled native-host executable, and Chromium / Firefox extension resources. No separately installed Node or Python is required.
- Installer setup prepares detected browsers and registers native hosts for the installing user. **It does not silently install an extension.** Follow the in-app setup guide and approve installation in your browser.
- No signing certificate was supplied to this development session. Check release test evidence for the actual Authenticode status. Do not assume a binary is signed because it has an installer icon.

[Detailed Windows installation and upgrade instructions](docs/INSTALL_WINDOWS.md) · [Browser installation and troubleshooting](docs/BROWSERS.md)

## Implemented functionality

### Files and history

- HTTP/HTTPS, redirect handling, streamed large-file downloads, real bytes/s and ETA when size and speed are known.
- Actual one-byte range capability probing; bounded asynchronous segmentation only when supported, with adaptive range counts and reusable keep-alive connections. Exact response range, segment length and final byte count checks.
- ID-isolated partials, persisted entity validators, safe continuation, restart when an entity changes, and atomic no-overwrite completion. Same-name files are numbered.
- Pause waits for writers/streams to stop. HTTP/media cancellation removes only that job's owned partials. Torrent cancellation stops peers while retaining verified pieces in its isolated folder. Retry, bounded transient HTTP retries, a shared per-transfer bandwidth limiter, and one concurrent-job queue for files/media/torrents.
- All / Active / Completed / Paused / Failed views, search, file-type filters, sorting, context menus, details, confirmed history removal / deletion, and OS file/folder opening, plus an Open source action for HTTP(S) links.
- Completed rows show format, size, completion time and location, with lazy cached OS/FFmpeg previews, plus open/reveal actions. Preview generation never loads the full media file into renderer memory.
- SQLite migration preserves v1 history. Interrupted transfers restore paused unless startup resumption is enabled. URLs without an entity validator restart safely instead of mixing old and new bytes. Downloaded files are never automatically executed.

### Media studio

- Real yt-dlp analysis, playable-format filtering, no MHTML storyboards or thumbnails in the format picker.
- Video and audio-only categories, resolution / frame rate / codecs / language where reported, and honest unknown or approximate sizes.
- Video-only selections add audio through bundled FFmpeg. Unknown audio tracks are **not** labeled included.
- Queued media jobs, JSON progress, cancellable child process trees, continuation where yt-dlp supports it, processing state during merge, history, and verification of the actual final output file.
- Separate Video & Audio, Thumbnails, Description, Tags and Subtitles tabs use metadata legitimately returned by yt-dlp. Download accessible thumbnails, save manual/automatic captions independently as VTT or SRT, or include a separate subtitle job alongside video. Conversion uses FFmpeg when required.
- No DRM bypass, playlist downloader, cookie import, or promise that every website works. Authentication / regional restrictions / site changes can prevent extraction; errors are shown.

### Browsers

Helium, Google Chrome, Chromium, Brave, Firefox, Vivaldi, Opera, plus Microsoft Edge.

- Shared real Chromium codebase and separate Firefox manifest. Browser-targeted ZIPs carry the correct configuration and installation guide—not placeholder implementations.
- Executable-path detection, portable-browser locator, guided first-run setup, stable unpacked folders, real native-host launcher, and current-user native-host registration.
- Ordinary HTTP(S) interception for documents, archives, images, media and unknown/large files. Native downloads pause before handoff; URL, available filename, URL-specific cookies (using the reported cookie store when available), referer and user agent are forwarded. Each handoff gets a unique identifier independent of browser download IDs. Accepted transfers cancel/erase only the matching native history entry, while transfer-ID reconciliation prevents duplicates after timeout/reconnection. Short/unpausable and private downloads remain native. Chromium service-worker handoff state is kept in browser-session storage for reconciliation after worker suspension; a full browser restart clears that session and can require the user to resume a paused native download. Browser APIs do not expose every original request header.
- Explicit context-menu actions, HTML5 media actions, bounded network-media detection, a compact per-video dismissible overlay and a usable popup.
- Native-first communication; explicitly paired WebSocket fallback. Per-user secret, restricted origins, bounded messages, request IDs, timeouts and live handshake-based health.
- **Prepared** and **registered** are not **installed / enabled**. Without a live handshake, extension installation and enablement are unknown. Firefox permanent installation requires Mozilla signing; this repository does not contain a signed XPI or store credentials.

### Preferences and workspace

Persisted defaults, simultaneous jobs, connections, per-download speed limit, timeout, retries, auto-start, a daily local-time start window, restart resumption, file categories, browser request confirmation, integration enablement, OS notifications, tray behavior, Windows/macOS login startup, start-minimized, twelve dark/light/alternative palettes plus system appearance, density and standard, reduced or disabled animation modes (with system reduced motion respected). Each displayed setting has a behavioral consumer; transfer connection/rate preferences apply on new/resumed jobs. Scheduled jobs stay queued across a clean restart, and the app must be running to start them. The schedule gates starts; it does not stop transfers already running when the window closes.

Single desktop titlebar, cohesive theme-aware controls, a dedicated Themes gallery and compact top-left quick switcher, keyboard-friendly dialogs, explicit loading/error states, responsive layouts and restrained animations. Every catalog palette and both system modes are tested for 4.5:1 text-token contrast on normal, raised and selected surfaces. Native frame/menu are no longer duplicated on Windows.

## Development

Use **Node 22.22+** and npm. Windows builds require Visual Studio C++ build tools / Python (if native fallback compilation is needed), .NET Framework's C# compiler (native launcher), and access to GitHub Releases. GitHub's `windows-latest` runner supplies these build tools.

```sh
npm ci                         # downloads Electron / builds native modules
npm run prepare:tools          # pinned, SHA-256-checked yt-dlp + FFmpeg/ffprobe
npm run build-extension        # unpacked resources + browser-specific ZIP packages
npm run dev                    # Vite + Electron
```

If you installed with `--ignore-scripts`, explicitly run `npm rebuild node-datachannel`. The locked better-sqlite3 13 package supplies platform N-API prebuilds compatible with both Node 22 and the packaged Electron runtime; it does not require switching legacy Node/Electron ABI binaries. Installed-app tests still verify actual SQLite loading and persistence.

```sh
npm rebuild node-datachannel               # if installed with --ignore-scripts
npm run build-extension
npm test
npm audit --audit-level=high
npm run build:renderer
npm run build:win                          # actual EXE + MSI, no automatic publication
```

`npm run prepare:tools` refuses unverified or missing Windows binaries. Tool versions / hashes are in `scripts/tools-manifest.json`. It deliberately does **not** silently fall back to an old third-party executable. macOS/Linux packaging is not certified by this Windows delivery; macOS additionally needs audited matching FFmpeg tools supplied manually.

### Real web preview

```sh
npm run dev:web
npm run test:ui             # in another terminal
```

This is an explicitly labeled development preview backed by the **real** SQLite and download services, isolated under `.arena/`. No mock download data or simulated progress is shipped. Browser registration, native folder dialogs, file launching and login startup need the installed desktop app. The preview API exists only in Vite development mode and is never packaged.

## Tests, architecture and delivery

- [Audit: actual defects and root causes](docs/AUDIT.md)
- [Architecture / data / security contracts](docs/ARCHITECTURE.md)
- [Measured tests, CI evidence and unverified requirements](docs/TESTING.md)
- [Windows packaging / installation](docs/INSTALL_WINDOWS.md)
- [Eight browser guides, permissions and troubleshooting](docs/BROWSERS.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Third-party tool licenses and source information](docs/THIRD_PARTY.md)

The Windows workflow builds installers, **installs both**, launches their actual executables, verifies downloads and media, tests restart/reinstall preservation, runs an actual Chromium-extension/native-host download, uninstalls, and retains reports. Built installers are retained immediately as `GetANNY-unsigned-test-build` artifacts even when later verification fails. These are clearly labelled development builds, **not** a passing release. Publishing requires explicit `publish=true` workflow dispatch or the opt-in commit trailer `GetANNY-Publish: prerelease` on this session branch, and every automated gate must succeed for the fully verified route. An explicit `GetANNY-Publish-Existing` request can instead publish the exact immutable existing RC with pending/failed verification prominently disclosed; provenance, binary checksums and uploaded asset digests are mandatory. It never promotes to stable. Releases remain prereleases until the manual gates are resolved.

## Data and troubleshooting

Data lives under Electron's per-user application-data directory (`getanny` by default). Open **Settings → Storage → Open data folder** to see SQLite history, preferences, extension resources, native manifests and setup diagnostics. Incomplete HTTP files are `.getanny-<id>.*` beside their destination. Media continuation files contain the job's full ID, avoiding prefix collisions. Do not rename these during a paused transfer.

- `HTTP 401/403`: the server requires authorization, denied automated access, or the link expired. Obtain a new direct link; use Media studio for supported media pages.
- `HTTP 404`: the resource is unavailable. Retrying an unchanged link does not repair it.
- Missing yt-dlp / FFmpeg / native launcher: reinstall the complete package or run the preparation script before building.
- `Server returned an incorrect byte range`: GetANNY refuses to assemble unsafe data. Retry with one connection; never rename a partial into a completed file.
- Native host cannot be found: run the selected browser's in-app setup again; see [browser troubleshooting](docs/BROWSERS.md).
- Port 29615 in use: close other GetANNY instances and retry. An unavailable bridge is shown offline; file downloads remain available.
- SmartScreen / unsigned extension warnings: expected for unsigned release candidates. Inspect source, checksums and release evidence; do not disable browser security or antivirus globally.
- Uninstall retains settings/history intentionally for upgrades. Remove the application-data directory manually **only** if you want to erase them. Browser extensions must also be removed in the browser's UI; uninstall never edits personal profiles.

## License

GetANNY source is [Apache-2.0](LICENSE). Separately executed yt-dlp and FFmpeg retain their own licenses; see [third-party notices](docs/THIRD_PARTY.md).
