/*  Isabelle symbol files in an ordinary VS Code installation.

The editor sees decoded Unicode, while the backing file keeps Isabelle's
\<name> notation. The language server receives ordinary file URIs.
*/

"use strict"

import { Disposable, EventEmitter, ExtensionContext, FileChangeType, FileStat,
  FileSystemError, FileSystemProvider, FileType, RelativePattern, TabInputText,
  TextEditor, Uri, window, workspace } from "vscode"
import * as Path from "path"
import * as Encoding from "./symbol_encoding"

export const scheme = "isabelle-file"

export function is_symbol_file(uri: Uri): boolean {
  return /\.(thy|ML|sml|sig)$/.test(uri.path)
}

export function disk_uri(uri: Uri): Uri {
  return uri.scheme === scheme ? uri.with({ scheme: "file" }) : uri
}

export function editor_uri(uri: Uri): Uri {
  return uri.scheme === "file" && is_symbol_file(uri) ? uri.with({ scheme }) : uri
}

export function protocol_uri(uri: Uri): string {
  return disk_uri(uri).toString()
}

export function from_protocol_uri(uri: string): Uri {
  return editor_uri(Uri.parse(uri))
}

class Symbol_File_System implements FileSystemProvider {
  private readonly changes = new EventEmitter<{ type: FileChangeType, uri: Uri }[]>()
  readonly onDidChangeFile = this.changes.event

  watch(uri: Uri, options: { recursive: boolean, excludes: readonly string[] }): Disposable {
    const file = disk_uri(uri)
    const base = options.recursive ? file : Uri.file(Path.dirname(file.fsPath))
    const pattern = options.recursive ? "**/*" : Path.basename(file.fsPath)
    const watcher = workspace.createFileSystemWatcher(new RelativePattern(base, pattern))
    const subscriptions = [
      watcher.onDidCreate(u => this.changes.fire([{ type: FileChangeType.Created, uri: editor_uri(u) }])),
      watcher.onDidChange(u => this.changes.fire([{ type: FileChangeType.Changed, uri: editor_uri(u) }])),
      watcher.onDidDelete(u => this.changes.fire([{ type: FileChangeType.Deleted, uri: editor_uri(u) }]))
    ]
    return new Disposable(() => {
      subscriptions.forEach(disposable => disposable.dispose())
      watcher.dispose()
    })
  }

  async stat(uri: Uri): Promise<FileStat> {
    const file = disk_uri(uri)
    const stat = await workspace.fs.stat(file)
    if (stat.type & FileType.File) {
      const content = await workspace.fs.readFile(file)
      return { ...stat, size: Encoding.decode(content).byteLength }
    }
    return stat
  }

  readDirectory(uri: Uri): Thenable<[string, FileType][]> {
    return workspace.fs.readDirectory(disk_uri(uri))
  }

  createDirectory(uri: Uri): Thenable<void> {
    return workspace.fs.createDirectory(disk_uri(uri))
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    return Encoding.decode(await workspace.fs.readFile(disk_uri(uri)))
  }

  async writeFile(uri: Uri, content: Uint8Array,
      options: { create: boolean, overwrite: boolean }): Promise<void> {
    const file = disk_uri(uri)
    let exists = false
    try { await workspace.fs.stat(file); exists = true }
    catch (error) {
      if (!(error instanceof FileSystemError && error.code === "FileNotFound")) throw error
    }
    if (exists && !options.overwrite) throw FileSystemError.FileExists(file)
    if (!exists && !options.create) throw FileSystemError.FileNotFound(file)
    await workspace.fs.writeFile(file, Encoding.encode(content))
    this.changes.fire([{ type: exists ? FileChangeType.Changed : FileChangeType.Created, uri }])
  }

  delete(uri: Uri, options: { recursive: boolean }): Thenable<void> {
    return workspace.fs.delete(disk_uri(uri), options)
  }

  rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }): Thenable<void> {
    return workspace.fs.rename(disk_uri(oldUri), disk_uri(newUri), options)
  }
}

const redirecting = new Set<string>()

async function redirect(editor: TextEditor | undefined): Promise<void> {
  if (!editor) return
  const document = editor.document
  const source = document.uri
  if (source.scheme !== "file" || !is_symbol_file(source) || document.isDirty) return
  const key = source.toString()
  if (redirecting.has(key)) return
  const tab = window.tabGroups.all.flatMap(group => group.tabs).find(tab =>
    tab.input instanceof TabInputText && tab.input.uri.toString() === key)
  if (!tab) return

  redirecting.add(key)
  try {
    const decoded = await workspace.openTextDocument(editor_uri(source))
    await window.showTextDocument(decoded, {
      viewColumn: editor.viewColumn,
      selection: editor.selection,
      preview: tab.isPreview
    })
    if (window.tabGroups.all.some(group => group.tabs.includes(tab))) {
      await window.tabGroups.close(tab, true)
    }
  }
  catch (error) {
    window.showErrorMessage(`Could not open Isabelle symbol view: ${error}`)
  }
  finally { redirecting.delete(key) }
}

export function setup(context: ExtensionContext): void {
  context.subscriptions.push(
    workspace.registerFileSystemProvider(scheme, new Symbol_File_System(), { isCaseSensitive: true }),
    window.onDidChangeActiveTextEditor(redirect),
    window.tabGroups.onDidChangeTabs(() => { void redirect(window.activeTextEditor) }))
  void redirect(window.activeTextEditor)
}
