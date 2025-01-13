import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import { TiaProjectTreeView } from './TiaProjectTreeView.js';
import { TiaProjectServerFetchApi } from './TiaProjectServerFetchApi.js';
import { extensionId } from './ExtensionInformation.js';
import { TiaEditor } from './TiaEditor.js';

let tiaProjectTreeView: TiaProjectTreeView;
let storedContext: vscode.ExtensionContext

export async function activate(context: vscode.ExtensionContext) {
	const tempDir = path.join(os.tmpdir(), extensionId);
	if (!fs.existsSync(tempDir))
		fs.mkdirSync(tempDir);

	tiaProjectTreeView = new TiaProjectTreeView(context);

	context.subscriptions.push(TiaEditor.register(context, tiaProjectTreeView));
	context.subscriptions.push(TiaEditor.registerForZip(context, tiaProjectTreeView));

	storedContext = context;

	TiaProjectServerFetchApi.runServer(context);

	context.subscriptions.push(vscode.commands.registerCommand('simatic-ax-tia-projects-addon.openTiaProject', async (uri: vscode.Uri) => {
		await tiaProjectTreeView.openTiaProject(uri.toString());
	}));

	context.subscriptions.push(vscode.commands.registerCommand('simatic-ax-tia-projects-addon.closeProject', async (item: vscode.TreeItem) => {
		await tiaProjectTreeView.closeProject(<any>item)
	}));
}

export async function deactivate() {
	TiaProjectServerFetchApi.stopServer(storedContext);

	try {
		const tempDir = path.join(os.tmpdir(), extensionId);
		fs.rmSync(tempDir, { recursive: true });
	} catch (err) { }
}