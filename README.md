# GetANNY — Advanced Download Manager

GetANNY is an Electron desktop download manager with a React interface, SQLite history, resumable HTTP(S) transfers, worker-thread range downloads, WebTorrent support, yt-dlp media extraction, and a browser extension communicating over a local WebSocket bridge.

## Requirements

- Node.js 18 or later and npm
- Build toolchain for `better-sqlite3` when a matching prebuild is unavailable
- Internet access to GitHub Releases to fetch yt-dlp and Electron binaries

## Install and run

```sh
npm install
npm run download-ytdlp
npm run build-extension
npm run dev
```

The desktop app listens for extension traffic on `127.0.0.1:29615`. Download history and settings are stored in Electron's per-user application-data directory. The yt-dlp executable is fetched for the current OS into `bin/` and marked executable on Unix-like systems.

## Build and test

```sh
npm test
npm run build       # package current platform
npm run build:win   # Windows x64 NSIS installer
npm run build:mac
npm run build:linux
```

Electron native modules must be rebuilt for Electron before packaging. The `postinstall` script runs `electron-builder install-app-deps`; if your environment cannot access Electron's headers, install the headers or provide a compatible Electron rebuild environment before packaging.

## Browser extension

`npm run build-extension` writes unpacked packages to `dist-extension/chrome` and `dist-extension/firefox`. In the browser's extension management page, enable developer mode and load the corresponding unpacked folder. The application can prepare an unpacked extension package and register the Native Messaging Host for Chrome, Edge, Brave, and Firefox. Packaged builds run the host through the Electron executable; development builds use the available Node.js runtime. WebSocket on `127.0.0.1:29615` is the direct/fallback transport.

## Notes

- Downloads support HTTP and HTTPS URLs, Range-based resume, and parallel range transfer when the server advertises byte ranges. Downloads are written to a partial file and renamed only after completion.
- Torrent support accepts magnet links or `.torrent` paths through the Torrent panel's IPC API and uses WebTorrent.
- Media format inspection and extraction require the downloaded yt-dlp binary.
- Build outputs, dependencies, databases, logs, and downloaded binaries are ignored by Git.
