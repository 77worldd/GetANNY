# Changelog

## 2.1.0 — Obsidian identity release

- Adopted the official supplied eagle/shield mark and GetANNY wordmark unchanged. A reproducible generator rebuilds transparency, recolours and resamples the original artwork into a multi-resolution Windows ICO, ICNS, application/tray/notification PNGs, installer header and sidebar bitmaps, favicon and browser-extension icons.
- Branded the application shell, startup screen, About panel and browser-assistant popup; both the mark and lettering render as theme-aware masks so the original artwork is never redrawn or replaced.
- Rebuilt the palette catalogue around the monochrome identity: **Obsidian** and **Porcelain** are the logo-native dark/light defaults, High Contrast is pure monochrome, and the nine other palettes keep their character with restrained accents. Removed leftover mint-specific glows in favour of theme tokens.
- Added installer artwork for NSIS/MSI and updated the in-app repository link to the official `p4yy/GetANNY` repository.
- Bumped the application and all browser packages to 2.1.0. Distribution remains unsigned; Firefox packages remain unsigned development ZIPs.

## 2.0.0 — Windows release source

- Added a daily local-time start window for queued downloads, including overnight schedules and clean-restart persistence.
- Browser review locks the intercepted file link and verifies the matching desktop transfer before cancelling the browser copy.
- Reconciled Chromium handoffs after service-worker suspension using browser-session storage, and avoided browser download-ID reuse collisions and a disconnect race.
- Added browser cookie-store selection when the download exposes a store ID, foreground attention for automatically accepted handoffs, and an Open source action.
- Added standard, reduced and disabled motion modes; compacted page headings and moved Themes beside Settings.
- Added a portable Windows build target and a staged distribution ZIP with installer, extensions, native-host components and setup guides. Release assembly is gated on Windows tests and ZIP content verification.

Known limitations include incomplete localization and Arabic RTL, unsigned Firefox development packages, no native-host cold launch from the portable executable, and unverified consumer Windows/browser scenarios. See the release's measured evidence before treating a package as tested.

## 2.0.0-rc.2

Introduced ordinary browser handoff, an asynchronous range engine, media metadata and subtitles, additional themes, and installed-app verification tooling. The published binaries and their actual verification limits are documented on the rc.2 release page.
