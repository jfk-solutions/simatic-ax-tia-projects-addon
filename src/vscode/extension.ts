import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

import { TiaProjectTreeView } from './TiaProjectTreeView.js';
import { TiaProjectServerFetchApi } from './TiaProjectServerFetchApi.js';
import { extensionId } from './ExtensionInformation.js';
import { TiaEditor } from './TiaEditor.js';


let tiaProjectTreeView: TiaProjectTreeView;
//const EXTENSION_COUNT_KEY = extensionId + '.countRunningInstances';

let storedContext: vscode.ExtensionContext
export async function activate(context: vscode.ExtensionContext) {
	const tempDir = path.join(os.tmpdir(), extensionId);
	if (!fs.existsSync(tempDir))
		fs.mkdirSync(tempDir);

	tiaProjectTreeView = new TiaProjectTreeView(context);

	context.subscriptions.push(TiaEditor.register(context, tiaProjectTreeView));
	context.subscriptions.push(TiaEditor.registerForZip(context, tiaProjectTreeView));

	storedContext = context;
	//const count = context.workspaceState.get<number>(EXTENSION_COUNT_KEY, 0);
	//await context.workspaceState.update(EXTENSION_COUNT_KEY, count + 1);

	TiaProjectServerFetchApi.runServerIfFirstInstance(context);

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('simatic-ax-tia-projects-addon.tiaPortalProjectServerUri')) {
			let cfg = vscode.workspace.getConfiguration('simatic-ax-tia-projects-addon');
			let baseUri = <string>cfg.get("tiaPortalProjectServerUri");
			TiaProjectServerFetchApi.updateBaseuriAndLaunchServer(context, baseUri);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('simatic-ax-tia-projects-addon.openTiaProject', async (uri: vscode.Uri) => {
		await tiaProjectTreeView.openTiaProject(uri.toString());
	}));

	context.subscriptions.push(vscode.commands.registerCommand('simatic-ax-tia-projects-addon.closeProject', async (item: vscode.TreeItem) => {
		await tiaProjectTreeView.closeProject(<any>item)
	}));
}

export async function deactivate() {
	try {
		const tempDir = path.join(os.tmpdir(), extensionId);
		fs.rmSync(tempDir, { recursive: true });
	} catch (err) { }
	//let count = storedContext.workspaceState.get<number>(EXTENSION_COUNT_KEY, 0);
	//count--;
	//await storedContext.workspaceState.update(EXTENSION_COUNT_KEY, count);
	//if (count <= 0)
	TiaProjectServerFetchApi.stopServer(storedContext);
}