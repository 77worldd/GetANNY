# GetANNY 2.1.3 — Workspace and tray refinement

GetANNY 2.1.3 tightens the desktop download workspace and corrects tray window behavior while preserving the existing download and browser workflows.

## Downloads workspace

- One primary **New download** action stays at the top of the sidebar. Search, file-type filters, Pause all, sort and Clear history share a compact toolbar above the list.
- The footer reports active or ready status, queued jobs, live transfer speed, completed downloads and the installed app version.
- Redundant transfer totals and primary-view Back controls have been removed. The displayed shortcut matches the host OS, and the existing CmdOrCtrl+N binding is unchanged.

## Browser integration and themes

- Browser bridge status is shown beside the page actions with its actual connection state and reported local endpoint. Setup remains a numbered three-step flow.
- Theme cards preview the application sidebar, header, toolbar, download rows and status strip using each theme’s colors.
- Settings controls use compact right-aligned inputs where appropriate. Existing preference storage and actions are unchanged.

## System tray

- Clicking the tray icon hides a visible window and restores/focuses a hidden or minimized window. The explicit **Show GetANNY** menu action always reveals it.
- Closing the window to the tray is no longer undone by an OS activation event. Explicit user actions, browser requests and notifications can still reveal the window.
- Choosing **Quit** closes the bridge, previews and transfer services. Browser reconnects no longer relaunch the app until it is opened manually.

## Distribution and verification

The Windows release includes the NSIS installer, MSI, portable executable, eight browser extension ZIPs, the staged distribution bundle, installation guides, measured Windows test evidence and SHA-256 checksums. This build is unsigned unless the release evidence says otherwise; an icon is not a signature. Firefox packages remain unsigned development ZIPs and require Mozilla signing for permanent installation.

Local verification for this source: 103 backend tests passed, including the tray/native-host reconnect regression and real yt-dlp/FFmpeg media and transfer lifecycle checks. The live Chromium preview passed 13 UI checks at 1320, 1024, 760 and 480 px, with 22 screenshots and no renderer errors. These results do not substitute for installed-app and browser gates; see `MEASURED_RESULTS.md` attached to the release for the exact Windows CI outcome.
