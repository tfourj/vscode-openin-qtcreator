# vscode-openin-qtcreator
Adds a simple button/command to open current workspace in Qt Creator

## Settings
- `openInQtCreator.qtCreatorPath`: Absolute path to `qtcreator` executable (optional).
- `openInQtCreator.openWithFile`: Open active file in Qt Creator instead of a folder.
- `openInQtCreator.targetMode`:
  - `workspace`: Open current workspace root.
  - `projectRoot`: Try to find nearest folder containing `CMakeLists.txt` or a `.pro` file, then open that folder.
