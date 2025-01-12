import { extensionId, extensionName } from "./ExtensionInformation.js";
import { ItemType } from "./ItemType.js";
import * as cp from "child_process";
import * as vscode from 'vscode';

export type Folder = { name: string, id: number, children: Folder[], additional?: string };
export type FolderResult = { folders: Folder[] };
export type ItemResult = { name: string, itemType: ItemType, data: string, stringData: string };

const extension = vscode.extensions.getExtension(extensionId);
const extensionPath = extension?.extensionPath + "/binary";
const extensionDll = extensionPath + "/TiaFileFormatServer.dll";
const SERVER_RUNNING_KEY = extensionId + '.serverRunning';

export class TiaProjectServerFetchApi {
	static baseUri: string;

	static async runServerIfFirstInstance(context: vscode.ExtensionContext) {
		const serverPid = context.workspaceState.get<number>(SERVER_RUNNING_KEY, -1);

		let cfg = vscode.workspace.getConfiguration(extensionName);
		
		const baseUri = <string>cfg.get("tiaPortalProjectServerUri");
		TiaProjectServerFetchApi.baseUri = baseUri ?? "http://127.0.0.1:5400";

		//if (serverPid < 0) {
		await TiaProjectServerFetchApi.updateBaseuriAndLaunchServer(context, baseUri);
		//}
	}

	static async updateBaseuriAndLaunchServer(context: vscode.ExtensionContext, baseUri: string) {
		await TiaProjectServerFetchApi.stopServer(context);

		TiaProjectServerFetchApi.baseUri = baseUri ?? "http://127.0.0.1:5400";

		if (true) { //disable when using c# directly
			let process = cp.spawn("dotnet", [extensionDll, this.baseUri], {
				cwd: extensionPath,
				//shell: true, detached: true
			});
			await context.workspaceState.update(SERVER_RUNNING_KEY, process.pid);
		}
	}

	static async stopServer(context: vscode.ExtensionContext) {
		const serverPid = context.workspaceState.get<number>(SERVER_RUNNING_KEY, -1);
		if (serverPid >= 0) {
			try {
				process.kill(serverPid, 'SIGINT');
			}
			catch { }
			await context.workspaceState.update(SERVER_RUNNING_KEY, -1);
		}
	}

	static async closeProject(file: string): Promise<void> {
		const response = await fetch(TiaProjectServerFetchApi.baseUri + "/closeProject", {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			method: "POST",
			body: JSON.stringify({ file: file })
		});
	}

	static async getFolders(file: string): Promise<FolderResult> {
		const response = await fetch(TiaProjectServerFetchApi.baseUri + "/getFolders", {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			method: "POST",
			body: JSON.stringify({ file: file })
		});

		const answer = <FolderResult>await response.json();
		return answer;
	}

	static async getItem(file: string, id: number, additional?: string): Promise<ItemResult> {
		const response = await fetch(TiaProjectServerFetchApi.baseUri + "/getItem", {
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			},
			method: "POST",
			body: JSON.stringify({ file: file, id: id, additional: additional })
		});

		const answer = <ItemResult>await response.json();
		return answer;
	}
}