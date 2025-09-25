"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "picolode" is now active!');
    // Auto-associate .l files with the picolisp language id while the extension is active
    try {
        const config = vscode.workspace.getConfiguration();
        const assoc = config.get('files.associations') || {};
        if (assoc['*.l'] !== 'picolisp') {
            // Update workspace configuration if possible, otherwise update global
            config.update('files.associations', { ...assoc, '*.l': 'picolisp' }, vscode.ConfigurationTarget.Workspace).then(() => {
                vscode.window.showInformationMessage("Associated '*.l' files with 'picolisp' for this workspace. (Undo available)", 'Undo').then(selection => {
                    if (selection === 'Undo') {
                        config.update('files.associations', assoc, vscode.ConfigurationTarget.Workspace);
                    }
                });
            }, () => {
                // ignore failures silently
            });
        }
    }
    catch (e) {
        // best-effort only
    }
    // Hello world command (kept for compatibility)
    const disposableHello = vscode.commands.registerCommand('picolode.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from picolode!');
    });
    context.subscriptions.push(disposableHello);
    // Decoration type used to show inline result after the evaluated expression
    const resultDecoration = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1rem',
            color: new vscode.ThemeColor('editorCodeLens.foreground')
        }
    });
    // Register the evaluation command
    const disposableEval = vscode.commands.registerCommand('picolode.evalSelection', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        const doc = editor.document;
        let code;
        let range;
        if (!editor.selection.isEmpty) {
            range = new vscode.Range(editor.selection.start, editor.selection.end);
            code = doc.getText(range);
        }
        else {
            const line = editor.selection.active.line;
            range = doc.lineAt(line).range;
            code = doc.lineAt(line).text;
        }
        if (!code.trim()) {
            vscode.window.showInformationMessage('Nothing to evaluate');
            return;
        }
        // Create a temporary file to hold the PicoLisp code
        const tmpPath = path.join(os.tmpdir(), `vscode-picolisp-eval-${Date.now()}.l`);
        try {
            fs.writeFileSync(tmpPath, code, { encoding: 'utf8' });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to write temp file: ${err}`);
            return;
        }
        // Read configuration for pil path and timeout
        const config = vscode.workspace.getConfiguration('picolode');
        const pilCmd = (config.get('pilPath') || 'pil').trim();
        const timeout = Number(config.get('timeout') || 5000);
        const pilArgs = [tmpPath];
        (0, child_process_1.execFile)(pilCmd, pilArgs, { timeout: timeout, maxBuffer: 200 * 1024 }, (error, stdout, stderr) => {
            let outputText;
            if (error) {
                if (error.code === 'ENOENT') {
                    outputText = 'pil: not found in PATH';
                }
                else {
                    outputText = `Error: ${error.message}`;
                }
                if (stderr && !stderr.includes(outputText)) {
                    outputText += ` | ${stderr.trim()}`;
                }
            }
            else {
                outputText = stdout.trim() || (stderr.trim() || '<no output>');
            }
            // Clean up temp file (best-effort)
            try {
                fs.unlinkSync(tmpPath);
            }
            catch { /* ignore */ }
            // Create a decoration showing the result after the evaluated range
            const decoration = {
                range: range,
                renderOptions: {
                    after: {
                        contentText: `=> ${outputText}`
                    }
                }
            };
            editor.setDecorations(resultDecoration, [decoration]);
            // Clear decoration after some time (e.g., 10 seconds)
            setTimeout(() => {
                try {
                    editor.setDecorations(resultDecoration, []);
                }
                catch { /* editor may be closed */ }
            }, 10000);
        });
    });
    context.subscriptions.push(disposableEval, resultDecoration);
    // Debug helper: show the current languageId for the active editor
    const disposableShowLang = vscode.commands.registerCommand('picolode.showLanguageId', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor');
            return;
        }
        const id = editor.document.languageId;
        vscode.window.showInformationMessage(`Active languageId: ${id}`);
        console.log('Active languageId:', id);
    });
    context.subscriptions.push(disposableShowLang);
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map