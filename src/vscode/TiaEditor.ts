import * as vscode from 'vscode';
import { TiaProjectTreeView } from './TiaProjectTreeView';

export class TiaEditor implements vscode.CustomReadonlyEditorProvider {

	public static readonly viewType = 'simatic-ax-tia-projects-addon.tiaEditor';
	public static readonly viewTypeZip = 'simatic-ax-tia-projects-addon.tiaEditorZip';

	public static register(context: vscode.ExtensionContext, treeView: TiaProjectTreeView): vscode.Disposable {
		const provider = new TiaEditor(treeView);
		const providerRegistration = vscode.window.registerCustomEditorProvider(TiaEditor.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,

			}
		});
		return providerRegistration;
	}

	public static registerForZip(context: vscode.ExtensionContext, treeView: TiaProjectTreeView): vscode.Disposable {
		const provider = new TiaEditor(treeView);
		const providerRegistration = vscode.window.registerCustomEditorProvider(TiaEditor.viewTypeZip, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		});
		return providerRegistration;
	}

	treeView: TiaProjectTreeView;
	constructor(treeView: TiaProjectTreeView) {
		this.treeView = treeView;
	}

	public async openCustomDocument(uri: vscode.Uri) {
		return { uri, dispose: () => { } };
	}

	public async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewEditor: vscode.WebviewPanel,
	): Promise<void> {
		webviewEditor.webview.options = { enableScripts: true };
		webviewEditor.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'openTiaProject':
					this.treeView.openTiaProject(document.uri.path);
					webviewEditor.dispose();
					return;
			}
		});
		webviewEditor.webview.html = this.getWebviewContents();
	}

	protected getWebviewContents(): string {
		return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">

	<meta name="viewport"
		content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">

	<title>TIA Portal File</title>
	<style>
	html, body {
		width: 100%; 
		height: 100%;
		overflow: hidden;
	}
	.center-text {
		display: flex;
		width: 100%; 
		height: 100%;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}
	</style>
</head>
<body data-vscode-context='{ "preventDefaultContextMenuItems": true }'>
	<div class="center-text">
		<p>${vscode.l10n.t("This is a TIA Portal Project.")}</p>
		<a id="btn" href="#" class="open-file-link">${vscode.l10n.t("Open it in the TIA Project View?")}</a>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const btn = document.getElementById('btn');
		btn.onclick = () => {
			vscode.postMessage({ type: 'openTiaProject' });
		}
	</script>
</body>
</html>`;
	}
}

export function reopenAsText(resource: vscode.Uri, viewColumn: vscode.ViewColumn | undefined) {
	vscode.commands.executeCommand('vscode.openWith', resource, 'default', viewColumn);
}
