# GetANNY

**Reliable downloads. Clear control.** A Windows-first Electron download manager with a React workspace, persistent SQLite history, verified HTTP range transfers, yt-dlp media downloads, and authenticated browser integration.

> **2.0.0-rc.1 is a release candidate.** It is not a claim that all seven browser brands or a pristine consumer Windows installation have been certified. Read [testing evidence and remaining gates](docs/TESTING.md). Release automation publishes only after actual EXE/MSI installation and installed-app tests pass. Unsigned installers and unsigned browser packages are clearly identified.

## Get the Windows app

Download **GetANNY Setup.exe** or **GetANNY Setup.msi**, browser ZIPs, and `SHA256SUMS.txt` from [GitHub Releases](https://github.com/77worldd/GetANNY/releases). Use **one installer format**, not both simultaneously. Windows 10/11 x64 is required.

- EXE: interactive per-user installer, installation-folder selection, Start Menu and optional desktop shortcut.
- MSI: Windows Installer package for interactive or scripted deployment; optional desktop shortcut.
- Both include the renderer, SQLite native module, HTTP workers, yt-dlp, FFmpeg/ffprobe, a compiled native-host executable, and Chromium / Firefox extension resources. No separately installed Node or Python is required.
- Installer setup prepares detected browsers and registers native hosts for the installing user. **It does not silently install an extension.** Follow the in-app setup guide and approve installation in your browser.
- No signing certificate was supplied to this development session. Check release test evidence for the actual Authenticode status. Do not assume a binary is signed because it has an installer icon.

[Detailed Windows installation and upgrade instructions](docs/INSTALL_WINDOWS.md) · [Browser installation and troubleshooting](docs/BROWSERS.md)

## Implemented functionality

### Files and history

- HTTP/HTTPS, redirect handling, streamed large-file downloads, real bytes/s and ETA when size and speed are known.
- Actual one-byte range capability probing; worker-thread segmentation only when supported. Exact response range, segment length and final byte count checks.
- ID-isolated partials, persisted entity validators, safe continuation, restart when an entity changes, and atomic no-overwrite completion. Same-name files are numbered.
- Pause waits for writers/workers to stop. Cancel removes this transfer's partials. Retry, bounded transient HTTP retries, a shared per-transfer bandwidth limiter, and one concurrent-job queue for files/media/torrents.
- All / Active / Completed / Paused / Failed views, search, file-type filters, sorting, context menus, details, confirmed history removal / deletion, and OS file/folder opening.
- SQLite migration preserves v1 history. Interrupted transfers restore paused unless startup resumption is enabled. URLs without an entity validator restart safely instead of mixing old and new bytes. Downloaded files are never automatically executed.

### Media studio

- Real yt-dlp analysis, playable-format filtering, no MHTML storyboards or thumbnails in the format picker.
- Video and audio-only categories, resolution / frame rate / codecs / language where reported, and honest unknown or approximate sizes.
- Video-only selections add audio through bundled FFmpeg. Unknown audio tracks are **not** labeled included.
- Queued media jobs, JSON progress, cancellable child process trees, continuation where yt-dlp supports it, processing state during merge, history, and verification of the actual final output file.
- No DRM bypass, playlist downloader, cookie import, or promise that every website works. Authentication / regional restrictions / site changes can prevent extraction; errors are shown.

### Browsers

Helium, Google Chrome, Chromium, Brave, Firefox, Vivaldi, Opera, plus Microsoft Edge.

- Shared real Chromium codebase and separate Firefox manifest. Browser-targeted ZIPs carry the correct configuration and installation guide—not placeholder implementations.
- Executable-path detection, portable-browser locator, guided first-run setup, stable unpacked folders, real native-host launcher, and current-user native-host registration.
- Explicit context-menu actions, HTML5 media actions, network-media detection and a usable popup.
- Native-first communication; explicitly paired WebSocket fallback. Per-user secret, restricted origins, bounded messages, request IDs, timeouts and live handshake-based health.
- **Prepared** and **registered** are not **installed / enabled**. Without a live handshake, extension installation and enablement are unknown. Firefox permanent installation requires Mozilla signing; this repository does not contain a signed XPI or store credentials.

### Preferences and workspace

Persisted defaults, simultaneous jobs, connections, per-download speed limit, timeout, retries, auto-start, restart resumption, file categories, browser request confirmation, integration enablement, OS notifications, tray behavior, Windows/macOS login startup, start-minimized, two dark palettes / system theme, density and reduced motion. Each displayed setting has a behavioral consumer; transfer connection/rate preferences apply on new/resumed jobs.

Single desktop titlebar, cohesive dark controls, keyboard-friendly dialogs, explicit loading/error states, responsive layouts and restrained animations. Native frame/menu are no longer duplicated on Windows.

## Development

Use **Node 22.22+** and npm. Windows builds require Visual Studio C++ build tools (SQLite), .NET Framework's C# compiler (native launcher), and access to GitHub Releases. GitHub's `windows-latest` runner supplies these build tools.

```sh
npm ci                         # downloads Electron / builds native modules
npm run prepare:tools          # pinned, SHA-256-checked yt-dlp + FFmpeg/ffprobe
npm run build-extension        # unpacked resources + browser-specific ZIP packages
npm run dev                    # Vite + Electron
```

If you installed with `--ignore-scripts`, explicitly run `npm rebuild node-datachannel`, rebuild SQLite for Node before `npm test`, and rebuild it for Electron before launching/packaging. SQLite binaries for Node and Electron use different ABIs.

```sh
npm rebuild better-sqlite3                 # Node test ABI
npm run build-extension
npm test
npm audit --audit-level=high
npm run build:renderer
npx electron-rebuild --force --only better-sqlite3
npm run build:win                          # actual EXE + MSI, no automatic publication
```

`npm run prepare:tools` refuses unverified or missing Windows binaries. Tool versions / hashes are in `scripts/tools-manifest.json`. It deliberately does **not** silently fall back to an old third-party executable. macOS/Linux packaging is not certified by this Windows delivery; macOS additionally needs audited matching FFmpeg tools supplied manually.

### Real web preview

```sh
npm rebuild better-sqlite3   # Node ABI, if necessary
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

The Windows workflow builds installers, **installs both**, launches their actual executables, verifies downloads and media, tests restart/reinstall preservation, runs an actual Chromium-extension/native-host download, uninstalls, and retains reports. Publishing requires an explicit workflow-dispatch input and every automated gate must succeed. Releases remain prereleases until the manual gates are resolved.

## Data and troubleshooting

Data lives under Electron's per-user application-data directory (`getanny` by default). Open **Settings → Storage → Open data folder** to see SQLite history, preferences, extension resources, native manifests and setup diagnostics. Incomplete HTTP files are `.getanny-<id>.*` beside their destination. Media continuation files contain the job's eight-character ID. Do not rename these during a paused transfer.

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
