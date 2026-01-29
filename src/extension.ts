import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function getQtCreatorCommand(): string {
  const cfg = vscode.workspace.getConfiguration("openInQtCreator");
  let configured = (cfg.get<string>("qtCreatorPath") || "").trim();

  if (configured) {
    // If user gave a folder, auto-append qtcreator.exe
    if (fs.existsSync(configured) && fs.statSync(configured).isDirectory()) {
      const exe = path.join(configured, "qtcreator.exe");
      if (fs.existsSync(exe)) return exe;
    }
    return configured;
  }

  return process.platform === "win32" ? "qtcreator.exe" : "qtcreator";
}

function getTargetPath(): string | null {
  const cfg = vscode.workspace.getConfiguration("openInQtCreator");
  const openWithFile = cfg.get<boolean>("openWithFile");

  if (openWithFile && vscode.window.activeTextEditor) {
    return vscode.window.activeTextEditor.document.uri.fsPath;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return null;

  return folders[0].uri.fsPath;
}

export function activate(context: vscode.ExtensionContext) {
  const commandId = "openInQtCreator.openWorkspace";

  // Command
  const cmd = vscode.commands.registerCommand(commandId, () => {
    const qt = getQtCreatorCommand();
    const target = getTargetPath();

    if (!target) {
      vscode.window.showErrorMessage("No workspace folder is open.");
      return;
    }

    try {
      const child = cp.spawn(qt, [target], {
        detached: true,
        stdio: "ignore"
      });
      child.unref();
    } catch (e: any) {
      vscode.window.showErrorMessage(
        `Failed to launch Qt Creator.\n${e?.message ?? e}`
      );
    }
  });

  // Status bar button
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(tools) Qt";
  statusBarItem.tooltip = "Open Workspace in Qt Creator";
  statusBarItem.command = commandId;
  statusBarItem.show();

  context.subscriptions.push(cmd, statusBarItem);
}

export function deactivate() {}
