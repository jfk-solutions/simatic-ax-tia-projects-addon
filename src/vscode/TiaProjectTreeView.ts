import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Folder, TiaProjectServerFetchApi } from './TiaProjectServerFetchApi.js';
import { ItemType } from './ItemType.js';
import { extensionId } from './ExtensionInformation.js';

export class TiaProjectTreeView implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.TreeDragAndDropController<vscode.TreeItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem[] | null> = new vscode.EventEmitter<vscode.TreeItem[] | null>();
	public onDidChangeTreeData: vscode.Event<vscode.TreeItem[] | null> = this._onDidChangeTreeData.event;
	projectTree: ProjectTreeItem[] = [];

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

		if (element instanceof ProjectTreeItem) {
			element.contextValue = 'project';
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
			const itemResult = await TiaProjectServerFetchApi.getItem(element.projectTreeItem.file, element.folder.id, element.folder.additional);

			switch (itemResult.itemType) {
				case ItemType.PNG: {
					const tempDir = path.join(os.tmpdir(), extensionId);
					const tempFilePath = path.join(tempDir, `${(<FolderTreeItem>element).folder.name?.replaceAll("/","_")?.replaceAll(" ","_") ?? 'unkown'}_${Date.now()}.png`);
					fs.writeFileSync(tempFilePath, itemResult.data, 'base64');
					const img = vscode.Uri.file(tempFilePath);
					await vscode.commands.executeCommand('vscode.openWith', img, 'imagePreview.previewEditor', { preview: true, focus: false });
					break;
				}
				case ItemType.BMP: {
					const tempDir = path.join(os.tmpdir(), extensionId);
					const tempFilePath = path.join(tempDir, `${(<FolderTreeItem>element).folder.name?.replaceAll("/","_")?.replaceAll(" ","_")  ?? 'unkown'}_${Date.now()}.bmp`);
					fs.writeFileSync(tempFilePath, itemResult.data, 'base64');
					const img = vscode.Uri.file(tempFilePath);
					await vscode.commands.executeCommand('vscode.openWith', img, 'imagePreview.previewEditor', { preview: true, focus: false });
					break;
				}
				case ItemType.SVG: {
					const tempDir = path.join(os.tmpdir(), extensionId);
					const tempFilePath = path.join(tempDir, `${(<FolderTreeItem>element).folder.name?.replaceAll("/","_")?.replaceAll(" ","_")  ?? 'unkown'}_${Date.now()}.svg`);
					fs.writeFileSync(tempFilePath, itemResult.data, 'base64');
					const img = vscode.Uri.file(tempFilePath);
					await vscode.commands.executeCommand('vscode.openWith', img, 'imagePreview.previewEditor', { preview: true, focus: false });
					break;
				}
				case ItemType.Javascript: {
					let setting: vscode.Uri = vscode.Uri.parse("untitled:" + itemResult.name + '.js');
					vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
						vscode.window.showTextDocument(a, { preview: true }).then(e => {
							e.edit(edit => {
								edit.insert(new vscode.Position(0, 0), itemResult.stringData);
							});
						});
					}, (error: any) => {
						console.error(error);
					});
					break;
				}
				case ItemType.CScript: {
					let setting: vscode.Uri = vscode.Uri.parse("untitled:" + itemResult.name + (!itemResult.name.endsWith('.h') ? '.c' : ''));
					vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
						vscode.window.showTextDocument(a, { preview: true }).then(e => {
							e.edit(edit => {
								edit.insert(new vscode.Position(0, 0), itemResult.stringData);
							});
						});
					}, (error: any) => {
						console.error(error);
					});
					break;
				}
				case ItemType.VBScript: {
					let setting: vscode.Uri = vscode.Uri.parse("untitled:" + itemResult.name + '.vb');
					vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
						vscode.window.showTextDocument(a, { preview: true }).then(e => {
							e.edit(edit => {
								edit.insert(new vscode.Position(0, 0), itemResult.stringData);
							});
						});
					}, (error: any) => {
						console.error(error);
					});
					break;
				}
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
				case ItemType.CSV: {
					let setting: vscode.Uri = vscode.Uri.parse("untitled:" + itemResult.name + '.csv');
					vscode.workspace.openTextDocument(setting).then((a: vscode.TextDocument) => {
						vscode.window.showTextDocument(a, { preview: true }).then(e => {
							e.edit(edit => {
								edit.insert(new vscode.Position(0, 0), itemResult.stringData);
							});
						});
					}, (error: any) => {
						console.error(error);
					});
					break;
				}
			}

			//@ts-ignore
			this.treeView.reveal(undefined, { focus: true });
		}
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
			vscode.window.showErrorMessage('Error: ' + (<any>err)?.cause?.toString());
		}
	}

	closeProject(item: ProjectTreeItem) {
		TiaProjectServerFetchApi.closeProject(item.file);
		this.projectTree.splice(this.projectTree.indexOf(item), 1);
		this._onDidChangeTreeData.fire(null);
	}
}

abstract class ChildrenTreeItem extends vscode.TreeItem {
	readonly abstract children: vscode.TreeItem[];
}
class ProjectTreeItem extends ChildrenTreeItem {
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

class FolderTreeItem extends ChildrenTreeItem {
	folder: Folder;
	projectTreeItem: ProjectTreeItem;
	parent: ChildrenTreeItem;

	constructor(folder: Folder, projectTreeItem: ProjectTreeItem, parent: ChildrenTreeItem) {
		super(
			folder.name,
			folder.children != null ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);

		this.folder = folder;
		this.projectTreeItem = projectTreeItem;
		this.parent = parent;
	}

	get children() {
		return this.folder.children.map(x => new FolderTreeItem(x, this.projectTreeItem, <any>this));
	}
}
