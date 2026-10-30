# Test evidence and release gates

Development began 29 October 2026; measured UTC timestamps are recorded below. The baseline was `f74fea83`. This file distinguishes executed tests from intended CI gates and manual work. No simulated transfer results are used as download evidence.

## Executed in the Linux Arena workspace

- Latest executed full Linux suite: **61/61 passed, 0 skipped, 49.38 seconds**. Includes explicit Quit/cold-launch/EOF behavior, registration-only history preservation and the real SQLite N-API / torrent / worker packaging contract and read-only MSI resource updates. Process-launch intent tests use a documented spy; actual download evidence uses real processes and transfers.
- **Measured Windows run [40976436847](https://github.com/77worldd/GetANNY/actions/runs/40976436847) on `2914b21`: 57 backend / 9 compiled C# checks passed, 0 skipped. EXE and MSI each passed all 14 installed-app checks on first installation and reinstall (56 checks total)**. This confirms the MSI read-only resource repair, real window minimize/maximize/restore and correct captions, native framing, HTTPS, actual media merging, local TCP torrent verification, renderer layouts and persisted restart markers. EXE uninstall and isolated-profile retention passed. Chromium, Helium, Brave and Opera each passed actual extension/native/popup-download/hash/content-script/media-download tests. **The overall job failed:** Vivaldi's headless process crashed (0xC0000005); Firefox's native connection succeeded, but WebDriver blocked the harness's `about:debugging` navigation before popup tests. MSI uninstall and publication were not reached. New headed Vivaldi, explicit test-only Firefox automation access, normal-UI Chrome consent, default-profile/output retention, native-registry cleanup, shortcut checks and actual cold/shortcut launch gates require a new measured Windows run; do not infer their success from this older run.
- Subsequent Windows run [40979541804](https://github.com/77worldd/GetANNY/actions/runs/40979541804) validated all PowerShell syntax and all 9 compiled C# checks, but its backend suite failed 1 of 61 checks while awaiting physically flushed media partial bytes; packaging was not reached. The managed continuation fixture is now a larger **real FFmpeg CBR video**, sized beyond the official Windows Python runtime's output buffering, with a rate/time budget appropriate for actual incomplete bytes on disk. Nonzero Range, physical partial and SHA-256 assertions remain mandatory. The revised fixture passed locally; its Windows outcome remains unverified.
- **Production renderer build and all 8 extension ZIP builds passed** after the latest UI/bridge changes.
- Node 22.22.3; actual better-sqlite3 13 platform N-API prebuild loaded and persistence verified.
- Actual local HTTP and HTTPS servers; TLS certificate generated at test time (not a checked-in private key). Certificate rejection and explicit test-CA trust tested separately. Runtime TLS validation is never disabled globally.
- 128 MiB HTTP range download, streamed through workers, exact final byte count and SHA-256 verified. Not a multi-terabyte stress test.
- One-connection and segmented pause/resume; writers/workers settled before restart; changed-ETag continuation safely restarted; cancellation cleanup; real 404 / truncated-body / bad-range failures; unsupported HEAD and ignored Range fallback; chunked unknown length; empty files; retry / queue limits / concurrent naming.
- SQLite v1 migration, metadata round-trip, failure/history filtering, clear/delete actions, persisted validated preferences and interrupted-state recovery.
- Real yt-dlp **2026.10.26** obtained from PyPI in this restricted environment; generated local HTML5 video and audio pages plus an adaptive DASH manifest. Actual downloads verified with ffprobe; separate video/audio were merged by actual FFmpeg. This does **not** certify YouTube or other live third-party sites.
- A managed yt-dlp lifecycle test stops the actual child only after physically nonzero partial bytes exist, closes/reopens services and SQLite, asserts nonzero HTTP Range continuation and SHA-256 equality, then verifies real cancellation cleanup and hash-verified retry. This is a real backend restart, not a claim of a full parent Electron cold restart. Full job IDs isolate media/torrent paths and prevent prefix-collision cleanup of unrelated files.
- Local fixture tests used registry-distributed development FFmpeg/ffprobe because the sandbox blocks GitHub's release-assets host. Windows production builds instead require the pinned SHA-256-verified tools in `scripts/tools-manifest.json`; there is no silent production fallback.
- Actual native-protocol subprocess → authenticated local WebSocket → SQLite manager → hash-verified file. This local process is Node on Linux, **not** the Windows C# launcher and **not** an installed branded browser.
- All seven target extension preparations / correct manifests / permissions; prepared does not assert installed. Auth failures and untrusted origins are rejected.
- Live-backend UI test script uses real Chromium and the actual preview services, not mocked IPC. It checks onboarding, add/pause/resume/failure, real media analysis/download, settings, keyboard dialogs and window widths 1320/1024/760/480. See `.arena/ui-test/report.json` for the latest executed result. **Latest executed run: 10 checks passed; 16 screenshots, no uncaught renderer errors (2026-10-30T00:07:30.840Z).** Shift+Tab/Tab focus trapping and focus return are asserted, not inferred from screenshots.
- Root `npm audit` after dependency updates / removal reports zero known vulnerabilities. This is not a guarantee of absence of vulnerabilities.

## Windows CI gates (must actually pass before publishing)

The workflow runs on **windows-latest**, not on this Linux sandbox. A green job requires:

1. Locked dependency install; real compiled C# smoke and Node unit/integration tests with actual pinned media tools.
2. Stable Chromium installation for real extension testing; packaged SQLite N-API payload verified.
3. Real **GetANNY Setup.exe** and **GetANNY Setup.msi** generated, with mandatory resources and binary hash verification.
4. EXE install; launch its **installed** executable; exercise isolated preload/IPC/renderer, HTTP/HTTPS, pause/resume/cancel/failure, yt-dlp video/audio/merge, local TCP WebTorrent, C# executable/native/WS chain, persistent history/settings and actual layout capture.
5. EXE same-version reinstall and process restart, preserving SQLite markers/history; actual default `%APPDATA%\getanny` profile self-test; read-only record-digest/count/physical-file snapshot before and after actual uninstall. Verify actual desktop/Start Menu shell launches (not just shortcut existence), compiled-native cold desktop launch → hash-verified download, graceful real window close without native-host resurrection, shortcut targets/removal, plus removal of owned native registry entries (report the actual number; zero is not proof).
6. MSI install; equivalent installed-app checks; MSI reinstall / restart preservation and equivalent real default-profile / output / shortcut / owned-registration retention and cleanup checks.
7. Actual unpacked **Playwright Chromium** extension, stable extension ID, real native-host handshake, popup-origin file hash verification, content-script detection, media request and download via the installed Electron UI.
8. Additional actual-browser tests when the verified binaries can be obtained: Helium, Brave, Vivaldi, Opera and Firefox. Firefox uses the supported **temporary** add-on WebDriver API; no signing preference or policy is disabled. Versions / SHA-256s and official download sources are in `scripts/windows/browser-test-manifest.json` (Vivaldi/Opera hashes were cross-checked against Microsoft's winget manifests). The Chrome harness uses the normal visible developer-mode toggle, “Load unpacked” button and actual Windows folder picker in an isolated throwaway profile, not removed load flags or policy/profile edits. Firefox automation explicitly grants WebDriver system access only for its temporary test profile to inspect the real assigned extension UUID; add-on signing requirements stay enabled. Production consent/store installation remains manual. Download unavailability is recorded as unverified, while functional failures in an available browser block this gate.
9. MSI uninstall; retained user history; actual Authenticode signature statuses recorded.
10. Reports / installer logs / actual screenshots retained even on failure. A release request only executes after prior steps succeed.

A workflow definition is **not** a passing result. Inspect the workflow run, `windows-test-evidence` artifact / Release `Windows-test-evidence.zip` and its JSON. Reports contain each check's pass/fail, timestamps and errors. The delivery report identifies the actual run and outcome, not a forecast.

## Browser certification matrix

Latest measured smoke results below refer to **40976436847**, not a forecast for newer source. Reports for a later release supersede this development snapshot.

| Browser           | Preparation       | Actual browser → native → download smoke result                                                 |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| Helium            | Automated         | **Passed** in the measured Windows run                                                          |
| Google Chrome     | Automated         | Not executed; new normal-UI developer-mode harness awaits Windows execution                     |
| Chromium          | Automated         | **Passed** with actual Playwright Chromium; not Google Chrome                                   |
| Brave             | Automated         | **Passed** in the measured Windows run                                                          |
| Firefox           | Separate manifest | Native connection succeeded; popup test blocked by WebDriver harness navigation; fix unverified |
| Vivaldi           | Automated         | Headless browser process crashed before loading; new headed test unverified                     |
| Opera             | Automated         | **Passed** in the measured Windows run                                                          |
| Edge (additional) | Automated         | Unverified individually                                                                         |

All passing entries are fresh-profile developer/temporary extension tests, **not** signed-store installation, upgrade, browser-restart or full lifecycle certification.

## Still requires manual testing / action

- A **pristine consumer Windows 10/11 VM**, with neither Node/Python nor developer tools preinstalled, installing and running EXE and MSI separately. GitHub runners have developer dependencies and do not prove this condition.
- Interactive EXE/MSI wizard branding, directory/desktop shortcut choices, UAC behavior and cancel/back flows. Default shortcut shell launches and compiled-native cold launch now have explicit gates; until their reports pass they are not verified.
- Real cross-version upgrade from the prior released v1 installer with real existing downloads/history, including interrupted legacy partials; same-version CI reinstall is not that test.
- Locked-browser host cleanup, multiple Windows users and portable / nonstandard paths.
- Remaining individual-browser smoke failures/unverified entries above, plus per-browser cold native launch, all page/context actions, browser restart/update, extension disable/re-enable and uninstall cleanup beyond the passing smoke checks.
- Firefox Mozilla signing / authorized store distribution; Chromium store publication / updates if desired. These require the owner's authorized accounts and approval, not security bypasses.
- Code signing / SmartScreen reputation if a signing identity is available. No certificate was supplied here.
- Live third-party media sites, authenticated / region-restricted pages, live streams, very large multi-gigabyte files, network loss / disk-full / power interruption, antivirus interaction, proxies and real-world torrent trackers.
- Accessibility review with assistive technology, high-DPI / multiple monitors and Windows theme/scaling combinations. Responsive and keyboard tests are not a full accessibility certification.

These outstanding gates mean the deliverable must remain a **release candidate**, not be represented as fully certified or complete for every requested environment.
