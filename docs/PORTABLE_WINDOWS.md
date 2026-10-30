# Portable GetANNY for Windows

Run `GetANNY Portable.exe` on Windows 10/11 x64. It is a self-extracting application and does not install an uninstaller or shortcuts. Settings and history remain in your Windows user profile; the executable is portable, but data is not stored beside it by default.

The native-messaging host needs a stable executable and resource path. The portable launcher extracts to a temporary location, so registering it as a persistent native host is not supported. For native messaging and browser-triggered cold launch, use the EXE or MSI installer instead. While the portable application is running, an extension can connect through the paired WebSocket fallback: extract the matching browser ZIP to a stable folder, load it as described in `BROWSERS.md`, then copy the pairing key from GetANNY's Browser integration page into the extension popup. Never share the pairing key.

Use one distribution at a time and back up your user data before changing versions. The portable executable and browser packages are unsigned unless the release's signature evidence explicitly states otherwise.
