# GetANNY implementation audit

Audit baseline: `f74fea83`, 29 October 2026. Screenshots supplied by the owner were reviewed alongside every source module, build script and existing test.

## Confirmed defects (not assumptions based on the README)

| Area                  | Root cause at baseline                                                                                                                       | Remediation target                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Download visibility   | Manager emits `added`, but main never forwards it; removing / clearing history does not update the in-memory queue                           | One lifecycle/event contract and authoritative snapshot                                                                   |
| HTTP integrity        | Ranges and assembled length not verified; no entity validators; partial names collide; unsafe overwrite; workers survive sibling failures    | Validate responses, entity metadata, exact byte counts, isolated partials, atomic no-clobber completion                   |
| Resume / cancellation | Pause does not wait for workers / stream closure; fallback ignores explicit filenames; retry can enqueue active items twice                  | Await engine settlement before releasing slots; persist resumable metadata                                                |
| Persistence           | Fixed SQLite columns discard `filenameExplicit`, file path, validators and media selections; stale speeds survive restart                    | Backward-compatible metadata migration, interrupted-state recovery                                                        |
| Media                 | yt-dlp spawn bypasses manager and database, blocks IPC until exit, parses progress on the wrong stream; no ffmpeg distribution               | Queued, persistent, cancellable media engine with machine-readable progress and verified output                           |
| Formats               | Only checks URL / ID, therefore includes MHTML storyboards; video-only selection omits audio; unknown sizes become zero                      | Filter playable codecs / DRM, group audio/video, explicit merging and size uncertainty                                    |
| Extension             | `nativeMessaging` permission missing; code refuses downloads without WebSocket even with native port; no authenticated handshake             | Native-first transport with real response correlation, authenticated fallback, honest health state                        |
| Native host           | Nonstandard manifest `args` ignored by browsers; points at Electron / Node without a real executable launcher                                | Dedicated Windows executable; executable Unix launcher; no unsupported manifest fields                                    |
| Browser setup         | Profile-file presence mistaken for installed executable; copied folder mistaken for installed extension; only four browser IDs               | Executable detection, seven requested targets plus Edge, prepared vs connected status, explicit user-consent installation |
| WebSocket             | Any extension origin and originless local process can send unauthenticated requests; stale connection counted as healthy                     | Strict origin rules, per-user secret, authenticated sessions / heartbeat, bounded payloads                                |
| Settings              | Defaults not returned; unvalidated arbitrary keys; most defaults unused; reset does not update runtime                                       | Validated persisted settings with actual behavioral consumers                                                             |
| Window / UI           | Native title + native menu + custom controls; form helper buttons default to submit; fixed-size layouts, raw inputs, no failure/paused views | Single window chrome, accessible components, cohesive responsive dark design, complete workflow                           |
| Shutdown              | Electron does not await async `before-quit`; database can close before streams settle                                                        | Explicit asynchronous shutdown guard                                                                                      |
| Torrent               | No authoritative pause state/history; unhandled EventEmitter `error`; paused torrents restarted automatically; no metadata timeout           | Unified managed torrent lifecycle, safe stop / restore, actionable errors                                                 |
| Packaging             | Only NSIS; bundled tools not mandatory; native rebuild disabled; workflow targets an obsolete branch; no installed-app test                  | EXE + MSI, tool verification, branch CI, installed-app checks, release checksums                                          |

## Security and scope

Never silently install browser extensions, modify browser profiles, or use enterprise policies. Browsers do not expose a trustworthy external installed/enabled query: **no connection means unknown**, not “not installed”. Firefox production installation requires Mozilla signing. Unsigned unpacked Chromium packages require explicit developer-mode consent. Local tests and mocked external process tests are not evidence that a live media website, browser or Windows installation works.

See `TESTING.md` and the generated CI test artifacts for measured results and remaining validation gates.

## Additional defects established during regression testing

- Segmented finalization emitted an intermediate progress event without the exact verified byte count and with stale network speed. A regression failed before repair; processing now reports verified bytes / zero speed / unknown ETA, while completion still waits for assembly, output verification and atomic publication.
- Small muted text failed a calculated 4.5:1 contrast threshold on raised/selected dark surfaces and system-light surfaces. Updated actual theme tokens and added live-renderer contrast assertions across all three palettes; this is not a full accessibility certification.
- CI evidence duplicated verbose 14-check reports into annotations that GitHub truncated near 4 KiB. The reporter now emits compact counts, deduplicated definitions and bounded batches; a production-sized unit fixture verifies limits and excludes private fields. Raw reports remain in the evidence artifact.
- Browser-test diagnostics now distinguish a clean-browser Vivaldi baseline from extension-loaded startup. Firefox uses the exact automation-only system-access flag required by the measured runtime. Chrome still uses normal consent UI and a native picker, with scoped process/window ownership checks, not profile/policy manipulation. These browser harness repairs require new Windows execution.

- A >3 GiB real-transfer check exposed settled pause counters lagging physical partials (45,415,315 displayed versus 46,463,891 stored in the failing run). Added single/segmented physical-byte reconciliation and a regression that failed before repair; resumed large output matched SHA-256.
- Installers are now retained before later verification, explicitly marked unverified; failed gates cannot silently turn a test build into a release. Uninstall helper results and terminating PowerShell diagnostics are retained for actual Windows diagnosis.
