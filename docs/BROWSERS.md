# Browser integration: installation, compatibility, updates and troubleshooting

## What can actually be detected

GetANNY checks executable locations and Windows App Paths registrations. Portable or nonstandard installations may need **Locate browser**. Detection never reads history or personal profile files. During an ordinary download handoff, the extension uses the browser cookies API for that specific URL; it does not read cookie databases directly.

Browsers do not provide an external trustworthy installed/enabled query to this application. Therefore:

- **Detected**: browser executable exists.
- **Prepared**: an extension folder exists. This is **not installed**.
- **Host registered**: a native manifest / current-user registry entry points to an executable launcher. This is **not connected**.
- **Connected and verified**: the extension completed an authenticated handshake and sends heartbeats. This proves it is enabled in a running browser session.
- **No handshake**: installed/enabled state is **unknown**. It could be absent, disabled, closed, misconfigured, or blocked.

Browser ID is supplied by the selected browser-targeted configuration; it is not a way to fingerprint browsers that deliberately mimic Chrome. Use the correct package / popup browser choice.

## Compatibility investigation

| Browser                     | Extension configuration                                                   | Management page                         | Windows native lookup used                                           | Installation / update                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helium                      | Shared Chromium MV3, stable public key / ID                               | `chrome://extensions`                   | Chrome-compatible HKCU `Software\Google\Chrome\NativeMessagingHosts` | Load unpacked; reload same folder on update. Windows Helium still names its executable `chrome.exe` under `imput\Helium\Application`.                                |
| Google Chrome               | Chromium MV3 (Chrome 116+)                                                | `chrome://extensions`                   | `Software\Google\Chrome\NativeMessagingHosts`                        | Developer-mode Load unpacked. No signed CRX / Chrome Web Store listing supplied.                                                                                     |
| Chromium                    | Chromium MV3                                                              | `chrome://extensions`                   | `Software\Chromium\NativeMessagingHosts`, Chrome fallback            | Load unpacked. Portable builds may need Locate browser.                                                                                                              |
| Brave                       | Chromium MV3                                                              | `brave://extensions`                    | Chrome-compatible lookup                                             | Load unpacked. Shields / per-site extension access can affect detection.                                                                                             |
| Mozilla Firefox             | Separate MV2 background / browser_action / Gecko ID and native permission | `about:debugging#/runtime/this-firefox` | `Software\Mozilla\NativeMessagingHosts`                              | Unsigned temporary add-on for development only. Permanent installation requires Mozilla signing. Reload after changes; temporary installation disappears on restart. |
| Vivaldi                     | Shared Chromium MV3                                                       | `vivaldi://extensions`                  | Vivaldi-specific registration plus Chrome-compatible fallback        | Developer-mode Load unpacked; reload on update.                                                                                                                      |
| Opera                       | Shared Chromium MV3                                                       | `opera://extensions`                    | Chrome-compatible native lookup                                      | Developer-mode Load unpacked; explicit extension approval / site access may be required. No Opera Add-ons listing supplied.                                          |
| Microsoft Edge (additional) | Shared Chromium MV3                                                       | `edge://extensions`                     | `Software\Microsoft\Edge\NativeMessagingHosts`, Chrome fallback      | Developer-mode Load unpacked; reload on update.                                                                                                                      |

Minimum MV3 Chrome version reflects native / service-worker and WebSocket support; the current release is targeted at current desktop browsers. Compatibility is not the same as successful testing in each branded browser. See [test matrix](TESTING.md).

Relevant upstream source reviewed during the audit:

- [Chromium native host lookup and executable launching](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/messaging/launch_context_win.cc)
- [Chromium native host manifest schema](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/messaging/native_messaging_host_manifest.cc) (no supported `args` field)
- [Helium native-host Chrome fallback patch](https://github.com/imputnet/helium/blob/main/patches/helium/core/scan-chrome-native-messaging-hosts.patch) (its explicit POSIX-only patch is **not** assumed to implement Windows support; standard Windows Chromium Chrome lookup is used)
- [Helium Windows branding / actual executable location](https://github.com/imputnet/helium-windows/blob/main/installer/helium.nsi)

Forks may change lookup behavior. Native failures are reported; paired WebSocket is an explicit, authenticated alternative rather than a silent success claim.

## Chromium-family setup (Helium, Chrome, Chromium, Brave, Vivaldi, Opera, Edge)

1. Open **GetANNY → Browser integration**. Select the actual browser.
2. Click **Set up**. This writes a stable unpacked extension folder under app data and registers the native host for your user.
3. Click **Open extensions page**, or enter the management URL above manually. If the executable was not detected, use **Locate browser**.
4. Enable **Developer mode**, click **Load unpacked**, and choose the displayed extension folder. Confirm the requested permissions. Pin the toolbar icon.
5. Open the GetANNY popup, click **Reconnect**, and check both popup and desktop for a verified **Native host** connection.
6. Start an ordinary HTTP(S) download, or right-click a direct download link → **Download with GetANNY**. Ordinary downloads are paused before handoff; depending on your desktop preference the request is queued or opened for review. After acceptance, the paused native entry is cancelled and erased without using the browser's delete-file action.
7. If confirmation is enabled, dismissing the review returns the native download to the browser. Accepting it keeps the desktop job associated with the browser transfer ID so reconnection cannot queue it twice.
8. For a video page choose **Analyze media in GetANNY**, use the popup's media action, or the compact video overlay. Select a real format and destination in Media studio. “Sent for review” / “media page opened” does not mean a file has already downloaded. The overlay's X dismisses it for that video during the current page session.

Alternatively extract the corresponding `GetANNY-<browser>-<version>.zip` from the Release to a permanent folder and load it there. Still run desktop setup to register the host. Keep the folder in place. Each ZIP shares the same reviewed scripts but carries the correct target-browser configuration and instructions. This is intentional code reuse, not seven separate placeholder extensions.

### Updating

Install the new desktop package, rerun browser setup to refresh its stable prepared directory, then click **Reload** on the browser extension management page. If using a Release ZIP, replace files in the existing extracted directory and Reload. Do not change directory unnecessarily; profiles may track the unpacked location. There is **no configured store update endpoint**, and the application does not pretend to update an add-on without browser approval.

## Firefox

Use the Firefox package only. The fixed Gecko ID is `getanny@getanny.app`; permissions include `nativeMessaging` and the manifest uses Firefox background scripts / `browser_action` rather than a Chromium service worker / `action`.

Development install: **about:debugging → This Firefox → Load Temporary Add-on → manifest.json**. It is temporary until Firefox restarts. The supplied ZIP is **not a signed XPI**. Regular Firefox permanent installation requires signing through Mozilla; no AMO account credentials, signature, store listing, or silent installation bypass was provided. Signing and the permanent-install workflow remain a release gate. Developer/Nightly special policies are not forced on users.

Updates: reload the temporary add-on, or obtain a newly Mozilla-signed package through an authorized signing/store release process when one exists. Do not rename an unsigned ZIP to XPI and call it production signed.

## Native messaging and fallback

Host ID: `com.getanny.native`. Chromium extension ID: `oocncjjghijimkajhmdjcgdffkfojpbg` (derived from the checked-in **public** manifest key, not a signing private key).

On Windows a real compiled `GetANNY.NativeHost.exe` reads its adjacent protected-user configuration and launches the installed Electron runtime in Node mode. No external Node installation and no unsupported manifest `args` field. The JS host frames messages with four-byte little-endian lengths, authenticates locally, and forwards request IDs / real results. A browser-invoked native host may start GetANNY if the desktop app is not running.

The bridge binds **only `127.0.0.1:29615`**. It requires a per-user random secret, restricted origins, an extension hello and regular heartbeats. It does not count a bare socket as a connected extension. This is intentionally loopback-only; it is not a browser-facing localhost API inside the remote web preview.

If native messaging fails, open **Need an alternative connection?** on the desktop. Reveal/copy the pairing key and paste it into the extension's **Connection & pairing** section. Select the actual browser, Save & connect. The key stays in your local user profile; never share it or commit it. Websites cannot use the bridge unauthenticated.

## Permissions and limitations

- `nativeMessaging`: invoke the local host.
- `storage`: browser choice and optional pairing secret.
- `tabs`: current page context and per-tab detections.
- `contextMenus`: explicit link/media/page send actions.
- `downloads`: observe ordinary native downloads, pause them before handoff, resume a rejected/dismissed request, and cancel/erase the native history entry after GetANNY accepts ownership. GetANNY does not request the browser's delete-file operation.
- `cookies` + HTTP(S) host permissions: forward cookies applicable to the intercepted URL so authenticated direct downloads can continue in the desktop engine.
- `webRequest`: inspect response content types and provide HTML5 media detection/actions.
- No password access, browser profile editing, enterprise policies, forced extension installation, or silent extension updates.

The handoff includes the available final URL, filename, URL-specific cookies, referer and browser user agent. **Browser download APIs do not expose every original request header**, so identical arbitrary-header forwarding is not claimed. Short, completed or otherwise unpausable downloads stay in the native manager rather than risking two active copies. Private/incognito downloads also stay native because a reliable cookie-store identity is not available to this handoff. If a response is ambiguous after timeout/disconnection, the native copy remains paused until status reconciliation; a definitive rejection resumes it. Clean desktop shutdown resumes still-reviewed native transfers.

Blob URLs are not transferable files; the original page is analyzed instead. DRM is unsupported. Logged-in media / signed short-lived URLs may fail without website-specific authentication. Detection is limited to accessible media/network responses and supported pages, not a claim to extract every site.

## Troubleshooting

- **Host not found**: select the right browser and Set up again; native manifests must use the current installation path. Restart the popup / browser. Portable builds may have different lookup paths; use pairing if necessary.
- **Permission denied**: approve extension site access. GetANNY does not bypass your browser's security UI.
- **Key rejected**: copy the full current key from the same running desktop user's data directory. Do not reuse another account's key.
- **No response**: start GetANNY, enable Browser integration in Settings, check port 29615 and connection status. Native port existence alone is not success.
- **Queued but no file yet**: check download status, the queue concurrency limit, auto-start preference, and whether confirmation is awaiting review in the desktop app.
- **Browser download remains paused after a connection loss**: reopen GetANNY and the extension popup, then Reconnect. The extension reconciles the transfer ID before choosing desktop ownership or native resume. This pause is intentional duplicate protection, not a second active download.
- **No detected media**: restricted browser pages, inaccessible/DRM players and some dynamically fetched streams are not downloadable. Send the original supported media page to analysis. See the actual error if the extractor rejects it.
- **After uninstall**: remove the extension through the browser UI. Prepared files / native keys are cleaned where owned; personal profiles are never edited. Close browsers to release native-executable locks before uninstalling.
