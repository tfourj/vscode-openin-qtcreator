import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";

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

function isPathInside(childPath: string, parentPath: string): boolean {
  const rel = path.relative(parentPath, childPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function hasProjectMarker(dirPath: string): boolean {
  if (fs.existsSync(path.join(dirPath, "CMakeLists.txt"))) return true;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && entry.name.endsWith(".pro"));
  } catch {
    return false;
  }
}

function findProjectRootFrom(startDir: string, workspaceRoot: string): string | null {
  let current = startDir;
  const root = path.resolve(workspaceRoot);

  while (true) {
    if (hasProjectMarker(current)) return current;
    if (path.resolve(current) === root) return null;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function findProjectRootInWorkspace(workspaceRoot: string): Promise<string | null> {
  const files = await vscode.workspace.findFiles(
    "**/{CMakeLists.txt,*.pro}",
    "**/{.git,node_modules,out}/**",
    50
  );

  const candidates = files
    .map((file) => path.dirname(file.fsPath))
    .filter((dir) => isPathInside(dir, workspaceRoot));

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });

  return candidates[0];
}

async function getTargetPath(): Promise<string | null> {
  const cfg = vscode.workspace.getConfiguration("openInQtCreator");
  const openWithFile = cfg.get<boolean>("openWithFile");
  const targetMode = cfg.get<string>("targetMode") || "workspace";

  if (openWithFile && vscode.window.activeTextEditor) {
    return vscode.window.activeTextEditor.document.uri.fsPath;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) return null;

  const workspaceRoot = folders[0].uri.fsPath;
  if (targetMode !== "projectRoot") return workspaceRoot;

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri?.scheme === "file" && isPathInside(activeUri.fsPath, workspaceRoot)) {
    const projectRoot = findProjectRootFrom(path.dirname(activeUri.fsPath), workspaceRoot);
    if (projectRoot) return projectRoot;
  }

  return (await findProjectRootInWorkspace(workspaceRoot)) || workspaceRoot;
}

export function activate(context: vscode.ExtensionContext) {
  const commandId = "openInQtCreator.openWorkspace";

  // Command
  const cmd = vscode.commands.registerCommand(commandId, async () => {
    const qt = getQtCreatorCommand();
    const target = await getTargetPath();

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
