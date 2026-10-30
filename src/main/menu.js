const { Menu, shell, app } = require("electron");
function createMenu({ mainWindow }) {
  const template = [
    {
      label: "GetANNY",
      submenu: [
        {
          label: "About GetANNY",
          click: () =>
            shell.openExternal("https://github.com/77worldd/GetANNY"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New download",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow()?.webContents.send("menu:add-download"),
        },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Project website",
          click: () =>
            shell.openExternal("https://github.com/77worldd/GetANNY"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  return app.getName();
}
module.exports = { createMenu };
