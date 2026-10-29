require("./download-tools")
  .prepareYtdlp()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
