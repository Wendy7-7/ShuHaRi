import { useT } from "../i18n";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../store";

interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
}

const MARKDOWN_RE = /\.(md|markdown)$/i;

function TreeNode({
  entry,
  depth,
  onRename,
  onDelete,
}: {
  entry: Entry;
  depth: number;
  onRename: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Entry[]>([]);
  const openReader = useApp((s) => s.openReader);
  const openEditor = useApp((s) => s.openEditor);

  const handleClick = async () => {
    if (!entry.is_dir) {
      if (MARKDOWN_RE.test(entry.name)) openReader(entry.path);
      else openEditor(entry.path);
      return;
    }
    if (!open && children.length === 0) {
      const list = await invoke<Entry[]>("list_dir", { path: entry.path });
      setChildren(list);
    }
    setOpen(!open);
  };

  return (
    <div>
      <div
        className="tree-node"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={handleClick}
        title={entry.path}
      >
        <span className="tree-icon">{entry.is_dir ? (open ? "▾" : "▸") : "·"}</span>
        <span className="tree-name">{entry.name}</span>
        {!entry.is_dir && (
          <span className="node-actions">
            <button
              className="node-btn"
              title={t("重命名")}
              onClick={(ev) => {
                ev.stopPropagation();
                onRename(entry);
              }}
            >
              ✎
            </button>
            <button
              className="node-btn"
              title={t("删除")}
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete(entry);
              }}
            >
              ✕
            </button>
          </span>
        )}
      </div>
      {entry.is_dir && open && (
        <div>
          {children.map((c) => (
            <TreeNode key={c.path} entry={c} depth={depth + 1} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree() {
  const t = useT();
  const workspace = useApp((s) => s.workspace);
  const fileTreeNonce = useApp((s) => s.fileTreeNonce);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("notes.md");
  const [newFileErr, setNewFileErr] = useState<string | null>(null);
  // 重命名 / 删除
  const [renameTarget, setRenameTarget] = useState<Entry | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const doRename = async () => {
    if (!renameTarget) return;
    try {
      const newPath = await invoke<string>("rename_file", {
        oldPath: renameTarget.path,
        newName: renameVal,
      });
      // 若该文件正开着，跟随改到新路径
      const s = useApp.getState();
      if (s.editorFile === renameTarget.path) s.openEditor(newPath);
      if (s.readerFile === renameTarget.path) useApp.setState({ readerFile: newPath });
      setRenameTarget(null);
      setRenameErr(null);
      useApp.getState().refreshFileTree();
    } catch (e) {
      setRenameErr(String(e));
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke("delete_file", { path: deleteTarget.path });
      const s = useApp.getState();
      if (s.editorFile === deleteTarget.path) useApp.setState({ editorFile: null, editorContent: "" });
      if (s.readerFile === deleteTarget.path) useApp.setState({ readerFile: null });
      setDeleteTarget(null);
      useApp.getState().refreshFileTree();
    } catch (e) {
      setDeleteErr(String(e));
    }
  };

  useEffect(() => {
    if (!workspace) return; // 启动初期工作区尚未注入，先不请求
    invoke<Entry[]>("list_dir", { path: workspace })
      .then((list) => {
        setEntries(list);
        setError(null);
      })
      .catch((e) => setError(String(e)));
  }, [workspace, fileTreeNonce]);

  const createFile = async () => {
    const name = newFileName.trim();
    if (!name) { setNewFileErr("请输入文件名"); return; }
    if (/[\\/]/.test(name)) { setNewFileErr("文件名不能包含路径分隔符"); return; }
    try {
      await invoke("save_file", {
        path: `${workspace}/${name}`,
        content: name.match(/\.(md|markdown)$/i) ? `# ${name.replace(/\.[^.]+$/, "")}\n\n` : "",
      });
      setNewFileOpen(false);
      setNewFileErr(null);
      setNewFileName("notes.md");
      useApp.getState().refreshFileTree();
    } catch (e) {
      setNewFileErr(String(e));
    }
  };

  return (
    <div className="filetree">
      <div className="tree-header">
        <span>{t("资源管理器")}</span>
        <span className="tree-actions">
          <button className="btn-sm tree-refresh" title={t("新建文件")} onClick={() => setNewFileOpen(true)}>＋</button>
          <button
            className="btn-sm tree-refresh"
            title={t("刷新")}
            onClick={() => useApp.getState().refreshFileTree()}
          >
            ⟳
          </button>
        </span>
      </div>
      {error ? (
        <div className="tree-error">{error}</div>
      ) : (
        entries.map((e) => (
          <TreeNode
            key={e.path}
            entry={e}
            depth={0}
            onRename={(t) => {
              setRenameTarget(t);
              setRenameVal(t.name);
              setRenameErr(null);
            }}
            onDelete={(t) => {
              setDeleteTarget(t);
              setDeleteErr(null);
            }}
          />
        ))
      )}
      {renameTarget && (
        <div className="modal-mask" onClick={() => setRenameTarget(null)}>
          <div className="modal newfile-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>{t("重命名")}</h3>
            <label>{t("新文件名")}</label>
            <input
              autoFocus
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !(e.nativeEvent as KeyboardEvent).isComposing) doRename(); }}
            />
            {renameErr && <p className="hint-text" style={{ color: "#f48771" }}>{renameErr}</p>}
            <div className="modal-actions">
              <button className="btn-sm" onClick={() => setRenameTarget(null)}>{t("取消")}</button>
              <button onClick={doRename}>{t("确定")}</button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="modal-mask" onClick={() => setDeleteTarget(null)}>
          <div className="modal newfile-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>{t("删除文件")}</h3>
            <p className="hint-text">确定删除「{deleteTarget.name}」？删除后不可恢复（学习记录不受影响）。</p>
            {deleteErr && <p className="hint-text" style={{ color: "#f48771" }}>{deleteErr}</p>}
            <div className="modal-actions">
              <button className="btn-sm" onClick={() => setDeleteTarget(null)}>{t("取消")}</button>
              <button className="btn-danger" onClick={doDelete}>{t("删除")}</button>
            </div>
          </div>
        </div>
      )}
      {newFileOpen && (
        <div className="modal-mask" onClick={() => setNewFileOpen(false)}>
          <div className="modal newfile-modal" onClick={(ev) => ev.stopPropagation()}>
            <h3>{t("新建文件")}</h3>
            <label>{t("文件名（在工作区根目录创建，支持 .md / .c / .py 等）")}</label>
            <input
              autoFocus
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !(e.nativeEvent as KeyboardEvent).isComposing) createFile(); }}
              placeholder="notes.md"
            />
            {newFileErr && <p className="hint-text" style={{ color: "#f48771" }}>{newFileErr}</p>}
            <div className="modal-actions">
              <button className="btn-sm" onClick={() => setNewFileOpen(false)}>{t("取消")}</button>
              <button onClick={createFile}>{t("创建")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
