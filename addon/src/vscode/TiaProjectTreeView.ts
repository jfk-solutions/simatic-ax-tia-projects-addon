import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { cpuInfo, Folder, ItemResult, TiaProjectServerFetchApi } from './TiaProjectServerFetchApi.js';
import { ItemType } from './ItemType.js';
import { extensionId } from './ExtensionInformation.js';

export class TiaProjectTreeView implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.TreeDragAndDropController<vscode.TreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem[] | null> = new vscode.EventEmitter<vscode.TreeItem[] | null>();
	public onDidChangeTreeData: vscode.Event<vscode.TreeItem[] | null> = this._onDidChangeTreeData.event;
	projectTree: MainTreeItem[] = [];

	lastClickTime: number | null = null;
	lastClickedItem: vscode.TreeItem | null = null;
	treeView: vscode.TreeView<vscode.TreeItem>;

	constructor(context: vscode.ExtensionContext) {
		this.treeView = vscode.window.createTreeView('tiaProjectTreeView', { treeDataProvider: this, showCollapseAll: true, canSelectMany: false, dragAndDropController: this });
		context.subscriptions.push(this.treeView);

		vscode.commands.registerCommand('tiaProjectTreeView.openFile', (resource) => this.showTreeItem(resource));
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		if (true) { //element.type === vscode.FileType.File) {
			element.command = { command: 'tiaProjectTreeView.openFile', title: "Open File", arguments: [element], };
			element.contextValue = 'file';
		}

		if (element instanceof MainTreeItem) {
			element.contextValue = 'main';
		}

		return element;
	}

	getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
		if (element instanceof FolderTreeItem)
			return element.parent;
		return undefined;
	}

	async showTreeItem(element: vscode.TreeItem) {
		if (element instanceof FolderTreeItem) {

			let itemResult: ItemResult | null = null;

			if (element.mainTreeItem instanceof ProjectTreeItem) {
				itemResult = await TiaProjectServerFetchApi.getItem(element.mainTreeItem.file, element.folder.id, element.folder.additional);
			} else if (element.mainTreeItem instanceof OnlineTreeItem) {
				itemResult = await TiaProjectServerFetchApi.onlineGetItem({ ...element.mainTreeItem.cpu, id: element.folder.id });
			}

			if (itemResult != null) {
				switch (itemResult.itemType) {
					case ItemType.PNG: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.png`, itemResult.data); break;
					case ItemType.BMP: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.bmp`, itemResult.data); break;
					case ItemType.SVG: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.svg`, itemResult.data); break;
					case ItemType.EMF: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.emf`, itemResult.data); break;
					case ItemType.WMF: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.wmf`, itemResult.data); break;
					case ItemType.GIF: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.gif`, itemResult.data); break;
					case ItemType.ICO: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.ico`, itemResult.data); break;
					case ItemType.JPG: this.openImage(`${(<FolderTreeItem>element).folder.name?.replaceAll("/", "_")?.replaceAll(" ", "_") ?? 'unkown'}_${Date.now()}.jpg`, itemResult.data); break;

					case ItemType.VBScript: this.openTextFile(itemResult.name + '.vb', itemResult.stringData); break;
					case ItemType.VBScript: this.openTextFile(itemResult.name + '.vb', itemResult.stringData); break;
					case ItemType.XML: this.openTextFile(itemResult.name + '.xml', itemResult.stringData); break;
					case ItemType.SclSource: this.openTextFile(itemResult.name + '.scl', itemResult.stringData); break;
					case ItemType.StlSource: this.openTextFile(itemResult.name + '.awl', itemResult.stringData); break;
					case ItemType.JSON: this.openTextFile(itemResult.name + '.json', itemResult.stringData); break;
					case ItemType.YAML: this.openTextFile(itemResult.name + '.yml', itemResult.stringData); break;
					case ItemType.CScript: this.openTextFile(itemResult.name + (!itemResult.name.endsWith('.h') ? '.c' : ''), itemResult.stringData); break;
					case ItemType.VBScript: this.openTextFile(itemResult.name + '.vb', itemResult.stringData); break;
					case ItemType.Javascript: this.openTextFile(itemResult.name + '.js', itemResult.stringData); break;
					case ItemType.CSV: this.openTextFile(itemResult.name + '.csv', itemResult.stringData); break;

					case ItemType.HTML: {
						const panel = vscode.window.createWebviewPanel(
							'tiaScreenPreview',
							`${itemResult.name}`,
							vscode.ViewColumn.One,
							{ enableScripts: true }
						);
						panel.webview.html = itemResult.stringData;
						break;
					}
				}

				//@ts-ignore
				this.treeView.reveal(undefined, { focus: true });
			}
		}
	}

	async openImage(filename: string, dataBase64: string) {
		const tempDir = path.join(os.tmpdir(), extensionId);
		const tempFilePath = path.join(tempDir, filename);
		fs.writeFileSync(tempFilePath, dataBase64, 'base64');
		const img = vscode.Uri.file(tempFilePath);
		await vscode.commands.executeCommand('vscode.openWith', img, 'imagePreview.previewEditor', { preview: true, focus: false });
	}

	openTextFile(filename: string, data: string) {
		let setting: vscode.Uri = vscode.Uri.parse("untitled:" + filename);
		vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
			vscode.window.showTextDocument(a, { preview: true }).then(e => {
				const edit = new vscode.WorkspaceEdit();
				edit.insert(setting, new vscode.Position(0, 0), data);
				vscode.workspace.applyEdit(edit);
			});
		}, (error: any) => {
			console.error(error);
		});
	}

	async getChildren(element?: ChildrenTreeItem | undefined): Promise<vscode.TreeItem[]> {
		if (element === undefined) {
			return this.projectTree;
		}
		return element.children;
	}

	dropMimeTypes = ['text/url-list', 'text/uri-list', 'files'];
	dragMimeTypes = [];

	handleDrag(source: readonly FolderTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): void | Thenable<void> {
	}

	async handleDrop(target: FolderTreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Promise<void> {
		const uriList = dataTransfer.get('text/uri-list');
		//@ts-ignore
		await this.openTiaProject(await uriList?.asString());
	}

	async openTiaProject(uri: string) {
		try {
			const fileUri = decodeURIComponent(uri).replace("file://", "");
			const folderResult = await TiaProjectServerFetchApi.getFolders(fileUri);
			let prj = new ProjectTreeItem(fileUri, fileUri);
			prj.children = folderResult.folders.map(x => new FolderTreeItem(x, prj, prj));
			this.projectTree.push(prj);
			this._onDidChangeTreeData.fire(null);
		}
		catch (err) {
			if ((<any>err)?.cause)
				vscode.window.showErrorMessage('Error: ' + (<any>err)?.cause?.toString());
			else
				vscode.window.showErrorMessage('Error: ' + (<any>err)?.toString());
		}
	}

	closeProject(item: MainTreeItem) {
		//TODO, disconnect plc
		if (item instanceof ProjectTreeItem)
			TiaProjectServerFetchApi.closeProject(item.file);
		else if (item instanceof OnlineTreeItem)
			TiaProjectServerFetchApi.disconnectPlc(item.cpu);
		this.projectTree.splice(this.projectTree.indexOf(item), 1);
		this._onDidChangeTreeData.fire(null);
	}

	async connectPlc(cpu: cpuInfo) {
		try {
			const folderResult = await TiaProjectServerFetchApi.onlineGetFolders(cpu);
			let prj = new OnlineTreeItem(cpu.ip, cpu);
			prj.children = folderResult.folders.map(x => new FolderTreeItem(x, prj, prj));
			this.projectTree.push(prj);
			this._onDidChangeTreeData.fire(null);
		}
		catch (err) {
			vscode.window.showErrorMessage('Error: ' + (<any>err)?.cause?.toString());
		}
	}
}

abstract class ChildrenTreeItem extends vscode.TreeItem {
	readonly abstract children: vscode.TreeItem[];
}

abstract class MainTreeItem extends ChildrenTreeItem {
}
class ProjectTreeItem extends MainTreeItem {
	name: string;
	file: string;

	//@ts-ignore
	children: FolderTreeItem[];

	constructor(name: string, file: string) {
		super(
			name,
			vscode.TreeItemCollapsibleState.Expanded);

		this.name = name;
		this.file = file;
	}
}

class OnlineTreeItem extends MainTreeItem {
	name: string;
	cpu: cpuInfo;

	//@ts-ignore
	children: FolderTreeItem[];

	constructor(name: string, cpu: cpuInfo) {
		super(
			name,
			vscode.TreeItemCollapsibleState.Expanded);

		this.name = name;
		this.cpu = cpu;
	}
}

class FolderTreeItem extends ChildrenTreeItem {
	folder: Folder;
	mainTreeItem: MainTreeItem;
	parent: ChildrenTreeItem;

	constructor(folder: Folder, mainTreeItem: MainTreeItem, parent: ChildrenTreeItem) {
		super(
			folder.name,
			folder.children != null ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

		this.folder = folder;
		this.mainTreeItem = mainTreeItem;
		this.parent = parent;
	}

	get children() {
		return this.folder.children.map(x => new FolderTreeItem(x, this.mainTreeItem, <any>this));
	}
}
