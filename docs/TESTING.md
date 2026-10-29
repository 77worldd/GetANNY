# Test evidence and release gates

Date: 29 October 2026. The baseline was `f74fea83`. This file distinguishes executed tests from intended CI gates and manual work. No simulated transfer results are used as download evidence.

## Executed in the Linux Arena workspace

- Latest executed full Linux suite: **55/55 passed, 0 skipped, 22.02 seconds**. Includes explicit Quit/cold-launch/EOF behavior, registration-only history preservation and the real SQLite N-API / torrent / worker packaging contract. Process-launch intent tests use a documented spy; actual download evidence uses real processes and transfers.
- **Windows Node suite and compiled C# native launcher passed** in run [40974371770](https://github.com/77worldd/GetANNY/actions/runs/40974371770). That run failed later at an incorrect SQLite resource-path assertion, not at the tests; it is not an installed-app pass. Both actual installer formats previously built in [40972729146](https://github.com/77worldd/GetANNY/actions/runs/40972729146), whose installed native handshake failed; do not confuse a successful build with verified installation.
- **Production renderer build and all 8 extension ZIP builds passed** after the latest UI/bridge changes.
- Node 22.22.3; actual better-sqlite3 13 platform N-API prebuild loaded and persistence verified.
- Actual local HTTP and HTTPS servers; TLS certificate generated at test time (not a checked-in private key). Certificate rejection and explicit test-CA trust tested separately. Runtime TLS validation is never disabled globally.
- 128 MiB HTTP range download, streamed through workers, exact final byte count and SHA-256 verified. Not a multi-terabyte stress test.
- One-connection and segmented pause/resume; writers/workers settled before restart; changed-ETag continuation safely restarted; cancellation cleanup; real 404 / truncated-body / bad-range failures; unsupported HEAD and ignored Range fallback; chunked unknown length; empty files; retry / queue limits / concurrent naming.
- SQLite v1 migration, metadata round-trip, failure/history filtering, clear/delete actions, persisted validated preferences and interrupted-state recovery.
- Real yt-dlp **2026.10.26** obtained from PyPI in this restricted environment; generated local HTML5 video and audio pages plus an adaptive DASH manifest. Actual downloads verified with ffprobe; separate video/audio were merged by actual FFmpeg. This does **not** certify YouTube or other live third-party sites.
- Local fixture tests used registry-distributed development FFmpeg/ffprobe because the sandbox blocks GitHub's release-assets host. Windows production builds instead require the pinned SHA-256-verified tools in `scripts/tools-manifest.json`; there is no silent production fallback.
- Actual native-protocol subprocess → authenticated local WebSocket → SQLite manager → hash-verified file. This local process is Node on Linux, **not** the Windows C# launcher and **not** an installed branded browser.
- All seven target extension preparations / correct manifests / permissions; prepared does not assert installed. Auth failures and untrusted origins are rejected.
- Live-backend UI test script uses real Chromium and the actual preview services, not mocked IPC. It checks onboarding, add/pause/resume/failure, real media analysis/download, settings, keyboard dialogs and window widths 1320/1024/760/480. See `.arena/ui-test/report.json` for the latest executed result. **Latest executed run: 9 checks passed; 16 screenshots, no uncaught renderer errors (2026-10-29T23:39:39.787Z).** Shift+Tab/Tab focus trapping and focus return are asserted, not inferred from screenshots.
- Root `npm audit` after dependency updates / removal reports zero known vulnerabilities. This is not a guarantee of absence of vulnerabilities.

## Windows CI gates (must actually pass before publishing)

The workflow runs on **windows-latest**, not on this Linux sandbox. A green job requires:

1. Locked dependency install; real compiled C# smoke and Node unit/integration tests with actual pinned media tools.
2. Stable Chromium installation for real extension testing; packaged SQLite N-API payload verified.
3. Real **GetANNY Setup.exe** and **GetANNY Setup.msi** generated, with mandatory resources and binary hash verification.
4. EXE install; launch its **installed** executable; exercise isolated preload/IPC/renderer, HTTP/HTTPS, pause/resume/cancel/failure, yt-dlp video/audio/merge, local TCP WebTorrent, C# executable/native/WS chain, persistent history/settings and actual layout capture.
5. EXE same-version reinstall and process restart, preserving SQLite markers/history; actual uninstall.
6. MSI install; equivalent installed-app checks; MSI reinstall / restart preservation.
7. Actual unpacked **Playwright Chromium** extension, stable extension ID, real native-host handshake, popup-origin file hash verification, content-script detection, media request and download via the installed Electron UI.
8. Additional actual-browser tests when the verified binaries can be obtained: Helium, Brave, Vivaldi, Opera and Firefox. Firefox uses the supported **temporary** add-on WebDriver API; no signing preference or policy is disabled. Versions / SHA-256s and official download sources are in `scripts/windows/browser-test-manifest.json` (Vivaldi/Opera hashes were cross-checked against Microsoft's winget manifests). Google Chrome's removed command-line loader is not bypassed; normal UI/store installation is a manual gate. Download unavailability is recorded as unverified, while functional failures in an available browser block this gate.
9. MSI uninstall; retained user history; actual Authenticode signature statuses recorded.
10. Reports / installer logs / actual screenshots retained even on failure. A release request only executes after prior steps succeed.

A workflow definition is **not** a passing result. Inspect the workflow run, `windows-test-evidence` artifact / Release `Windows-test-evidence.zip` and its JSON. Reports contain each check's pass/fail, timestamps and errors. The delivery report identifies the actual run and outcome, not a forecast.

## Browser certification matrix

| Browser           | Manifest / package preparation | Actual branded-browser connection and download                                 |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| Helium            | Automated                      | Unverified until individually tested                                           |
| Google Chrome     | Automated                      | Unverified until individually tested; Chromium is not Chrome                   |
| Chromium          | Automated                      | Real-browser Windows CI gate; see actual report before claiming success        |
| Brave             | Automated                      | Unverified until individually tested                                           |
| Firefox           | Separate manifest automated    | Unverified; permanent unsigned installation is not possible on regular Firefox |
| Vivaldi           | Automated                      | Unverified until individually tested                                           |
| Opera             | Automated                      | Unverified until individually tested                                           |
| Edge (additional) | Automated                      | Unverified until individually tested                                           |

## Still requires manual testing / action

- A **pristine consumer Windows 10/11 VM**, with neither Node/Python nor developer tools preinstalled, installing and running EXE and MSI separately. GitHub runners have developer dependencies and do not prove this condition.
- Interactive EXE/MSI wizard branding, directory/desktop shortcut choices, Start Menu/shortcut launches, UAC behavior and cancel/back flows.
- Real cross-version upgrade from the prior released v1 installer with real existing downloads/history, including interrupted legacy partials; same-version CI reinstall is not that test.
- Locked-browser host cleanup, multiple Windows users and portable / nonstandard paths.
- All seven branded browsers individually, including cold native launch, page actions, restart, extension disable/re-enable, correct request routing and uninstall cleanup.
- Firefox Mozilla signing / authorized store distribution; Chromium store publication / updates if desired. These require the owner's authorized accounts and approval, not security bypasses.
- Code signing / SmartScreen reputation if a signing identity is available. No certificate was supplied here.
- Live third-party media sites, authenticated / region-restricted pages, live streams, very large multi-gigabyte files, network loss / disk-full / power interruption, antivirus interaction, proxies and real-world torrent trackers.
- Accessibility review with assistive technology, high-DPI / multiple monitors and Windows theme/scaling combinations. Responsive and keyboard tests are not a full accessibility certification.

These outstanding gates mean the deliverable must remain a **release candidate**, not be represented as fully certified or complete for every requested environment.
