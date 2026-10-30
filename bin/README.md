# Generated runtime tools (not committed)

`npm run prepare:tools` fetches pinned official yt-dlp and FFmpeg/ffprobe binaries, checks SHA-256 against `scripts/tools-manifest.json`, and on Windows compiles the real C# native-host launcher. Windows packaging refuses missing or mismatched required files. FFmpeg license / build-source notices are included beside its executables. See `docs/THIRD_PARTY.md`.

The restricted Linux development environment can use separately installed development tools for local tests; these must not be silently substituted into Windows installers. All binaries and generated files in this directory are ignored by Git.
