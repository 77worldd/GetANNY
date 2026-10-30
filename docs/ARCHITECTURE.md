# Architecture and lifecycle contracts

## Processes

- Electron main owns services, SQLite, filesystem/shell, native dialogs and validated IPC.
- Sandboxed/context-isolated renderer uses a fixed preload allowlist. IPC checks the actual main frame/sender; no generic filesystem or shell execution API is exposed.
- `createServices` composes existing HTTP worker architecture, media and torrent engines, validated settings, browser tooling and the local bridge. The explicit Vite-only preview reuses these services with an isolated database and returns errors for desktop-only actions.
- Windows native launcher is a compiled C# EXE. It relays standard I/O to the installed Electron runtime with `ELECTRON_RUN_AS_NODE=1`, which runs the JS framing bridge. Native manifests contain executable path, stdio type and exact extension allowlist—not unsupported argument fields.

## Transfer states

`paused / queued → connecting → downloading → processing → completed`, or `failed / retrying / cancelled`. Slots count active engines until their start promise settles. Pause/cancel must await streams/workers/process trees before a new engine is allowed to write the same job's partials. Queue insertion and manual retry are idempotent for active jobs.

- HTTP: capability probe uses an actual range response. Entity ETag / Last-Modified / total size and segment layout are persisted next to ID-scoped partials. Exact Content-Range, length and final stat are verified. Unknown total remains unknown until end of stream. Atomic same-directory hard link fails if an existing target appears; no overwrite.
- Segments use bounded-memory worker streams. Throttle requests go to one per-transfer limiter, so parallel connections do not multiply the configured speed limit. On sibling failure workers are stopped and awaited. Assembly streams parts, then validates final byte count.
- Media: full job IDs isolate output and partial cleanup (never a shared eight-character prefix). A recent analyzed selection generates the yt-dlp format selector. Machine-readable progress is streamed, audio merging requires FFmpeg, and final completion requires successful process exit plus an actual nonempty reported file inside the expected destination. Pause uses continuation files; some websites cannot resume and may restart.
- Torrents: per-job WebTorrent clients use an ID-isolated destination folder, verify pieces and persist data on pause; resume reopens/rechecks files. Completion stops seeding. Cancellation stops the client but retains verified pieces; torrent directories are never recursively deleted by a generic file/history action. A local TCP transfer is an installed-app CI gate; no public-tracker speed claims are made.

## SQLite / preferences

WAL + busy timeout; v1 additive migration to `metadata`. Core searchable columns stay intact; structured metadata retains explicit names, real output paths, media selection, retry state and validated transfer information. Settings use JSON values with an allowlist, type/range/path validation and actual runtime consumers. Connection / per-download rate changes apply on new/resumed jobs; concurrency and browser enablement take effect immediately.

No passwords or tokens are logged. Per-user bridge identity and native configuration are local app-data files, never source files. Unix files are mode 0600 / executable launcher 0700; Windows relies on the current user's app-data ACL. The checked-in extension key is **public** and fixes extension ID; it is not a signing key.

## Browser protocol

1. Native launcher reads its local configuration; native JS authenticates to loopback using the per-user secret. Fallback WebSocket requires the user's explicit key pairing.
2. Extension sends `hello` with configured browser ID, stable extension ID and version.
3. Server verifies the handshake and tracks actual heartbeat recency; bare sockets do not count as connected.
4. Download requests carry a request ID. File requests are queued or explicitly acknowledged as **review**; media requests are acknowledged as **analyze**, not fake download success.
5. A matching response or clear timeout/error reaches the popup / media action. URLs and protocol are validated again at the manager boundary.

WebSocket binds loopback, restricts origins, bounds payloads, rejects unauthenticated requests, limits pending confirmations, and serializes requests per session. It is not a remotely exposed backend. The development preview uses same-origin relative requests to Vite and is not included in production.

## Shutdown and packaging

An asynchronous Electron shutdown guard stops the bridge and awaits engines before closing SQLite. Tray-close behavior is honored only when a tray actually exists. Builders require renderer, both extension manifests, native modules, tools, licenses and a real Windows launcher. NSIS/MSI register hosts in HKCU; no browser policy or profile edits. Uninstall removes only registrations owned by the app and preserves history/downloads. Browser-side add-ons must be removed through browser UI.
