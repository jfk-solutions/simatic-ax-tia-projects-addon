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

	let searchCommand = vscode.commands.registerCommand('simatic-ax-tia-projects-addon.searchTree', async () => {
		const searchQuery = await vscode.window.showInputBox({
			placeHolder: 'Search in TIA Projects',
		});
		if (searchQuery) {
			// Filter tree based on searchQuery here
			console.log('Search query:', searchQuery);
			// Update your tree to show only the matching results
		}
	});
	context.subscriptions.push(searchCommand);

	let connectPlcCommand = vscode.commands.registerCommand('simatic-ax-tia-projects-addon.connectPlc', async () => {
		const ip = await vscode.window.showInputBox({
			placeHolder: 'IP Address',
		});
		if (ip) {
			await tiaProjectTreeView.connectPlc({ ip: ip, port: 102 });
		}
	});
	context.subscriptions.push(connectPlcCommand);

	let listPlcCommand = vscode.commands.registerCommand('simatic-ax-tia-projects-addon.listPlc', async () => {
		const nw = await TiaProjectServerFetchApi.listPlc();
		const options = nw.networkItems.map(x => ({ label: x.name, description: x.type + ' - ' + x.ipAddress, ip: x.ipAddress }));
		const selected = await vscode.window.showQuickPick(options);
		if (selected) {
			await tiaProjectTreeView.connectPlc({ ip: selected.ip, port: 102 });
		}
	});
	context.subscriptions.push(listPlcCommand);

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