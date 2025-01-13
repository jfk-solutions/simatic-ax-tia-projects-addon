import { extensionId, extensionName } from "./ExtensionInformation.js";
import { ItemType } from "./ItemType.js";
import * as cp from "child_process";
import * as vscode from 'vscode';
import getPort, { portNumbers } from "./PortHelper.js";

export type Folder = { name: string, id: number, children: Folder[], additional?: string };
export type FolderResult = { folders: Folder[] };
export type ItemResult = { name: string, itemType: ItemType, data: string, stringData: string };

const extension = vscode.extensions.getExtension(extensionId);
const extensionPath = extension?.extensionPath + "/binary";
const extensionDll = extensionPath + "/TiaFileFormatServer.dll";

export class TiaProjectServerFetchApi {
	static baseUri: string;
	static process: cp.ChildProcessWithoutNullStreams | null

	static async runServer(context: vscode.ExtensionContext) {
		TiaProjectServerFetchApi.baseUri = "http://127.0.0.1:55400";
		if (true) { //disable when using c# directly
			let port = await getPort({ port: portNumbers(55400, 60000) });
			TiaProjectServerFetchApi.baseUri = "http://127.0.0.1:" + port;
			try {
				TiaProjectServerFetchApi.process = cp.spawn("dotnet", [extensionDll, this.baseUri], {
					cwd: extensionPath,
					//shell: true, detached: true
				});
			}
			catch (err) {
				vscode.window.showErrorMessage('Error: ' + (<any>err)?.cause?.toString());
			}
		}
	}

	static async stopServer(context: vscode.ExtensionContext) {
		if (TiaProjectServerFetchApi.process) {
			try {
				process.kill(<number>TiaProjectServerFetchApi.process.pid, 'SIGINT');
			}
			catch { }
			TiaProjectServerFetchApi.process = null;
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