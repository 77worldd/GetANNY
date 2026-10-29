const { prepareYtdlp, prepareFfmpeg } = require("./download-tools");
(async () => {
  await prepareYtdlp();
  await prepareFfmpeg();
  if (process.platform === "win32")
    require("node:child_process").execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        require("node:path").join(__dirname, "windows/build-native-host.ps1"),
      ],
      { stdio: "inherit" },
    );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
