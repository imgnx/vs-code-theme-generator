const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/** @type {Map<string, vscode.TextEditorDecorationType>} */
let decorationTypes;

function getSidecarPath(filePath) {
  return `${filePath}.ann.json`;
}

function readAnnotations(filePath) {
  const annPath = getSidecarPath(filePath);
  if (!fs.existsSync(annPath)) return null;
  try {
    const txt = fs.readFileSync(annPath, 'utf8');
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.ranges)) return null;
    return data;
  } catch (e) {
    console.error('Annotator: failed reading', annPath, e.message);
    return null;
  }
}

function ensureDecoration(color) {
  if (!decorationTypes.has(color)) {
    const type = vscode.window.createTextEditorDecorationType({
      backgroundColor: color,
      isWholeLine: false,
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      light: { backgroundColor: color },
      dark: { backgroundColor: color + '40' }
    });
    decorationTypes.set(color, type);
  }
  return decorationTypes.get(color);
}

function clearAll(editor) {
  for (const type of decorationTypes.values()) {
    editor.setDecorations(type, []);
  }
}

function applyAnnotations(editor, data) {
  const buckets = new Map(); // color -> ranges
  for (const r of data.ranges) {
    if (!r || !r.start || !r.end || typeof r.color !== 'string') continue;
    const start = new vscode.Position(Math.max(0, r.start.line || 0), Math.max(0, r.start.col || 0));
    const end = new vscode.Position(Math.max(0, r.end.line || 0), Math.max(0, r.end.col || 0));
    const range = new vscode.Range(start, end);
    if (!buckets.has(r.color)) buckets.set(r.color, []);
    buckets.get(r.color).push(range);
  }
  // Clear previous and set new
  clearAll(editor);
  for (const [color, ranges] of buckets) {
    const type = ensureDecoration(color);
    editor.setDecorations(type, ranges);
  }
}

function refreshActive() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const filePath = editor.document.fileName;
  const data = readAnnotations(filePath);
  if (!data) {
    clearAll(editor);
    return;
  }
  applyAnnotations(editor, data);
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  decorationTypes = new Map();

  const cmd = vscode.commands.registerCommand('inlineColorAnnotator.refresh', refreshActive);
  context.subscriptions.push(cmd);

  // Refresh when active editor changes or saves
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => refreshActive()),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const active = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
      if (active && active.uri.toString() === doc.uri.toString()) refreshActive();
      // Also refresh if the sidecar itself was saved
      if (doc.fileName.endsWith('.ann.json')) refreshActive();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      // If sidecar file changed via external tool, update decorations
      if (e.document && e.document.fileName.endsWith('.ann.json')) refreshActive();
    })
  );

  // Initial pass after startup
  setTimeout(refreshActive, 100);
}

function deactivate() {
  if (decorationTypes) {
    for (const type of decorationTypes.values()) type.dispose();
    decorationTypes.clear();
  }
}

module.exports = { activate, deactivate };

