# Chrome Tab Tracker Extension

This repository contains the unpacked source for the Chrome Tab Tracker extension. Use this folder directly when loading the extension in Chrome during development.

## Folder location

After cloning the repository, the extension files live at:

```
FlowScope/productivity assistance/chrome tab tracker
```

Inside that directory you will find `manifest.json`, background scripts, and the popup assets that Chrome requires. When Chrome asks you to "Load unpacked", select this exact folder (the one that contains `manifest.json`).

### Checking the path from a terminal

If you are unsure of the exact path on your machine, open a terminal in the repository and run:

```bash
pwd
```

This prints the current directory. Verify that `manifest.json` exists by listing files:

```bash
ls
```

If you see `manifest.json` alongside `background.js`, `content.js`, and other files, you are in the correct folder to load the extension.

## Loading the extension in Chrome

1. Open `chrome://extensions` in your Chrome browser.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Browse to the folder described above and press **Select Folder** (Windows/Linux) or **Open** (macOS).

Chrome should now load the extension for testing. If you reorganize the project or add a build step in the future, make sure the folder you choose still contains `manifest.json` at its top level.
