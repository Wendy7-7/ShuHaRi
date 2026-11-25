import { useT } from "../i18n";
import Editor, { type OnMount } from "@monaco-editor/react";
import { KeyMod, KeyCode } from "monaco-editor";
import { initVimMode, type VimMode } from "monaco-vim";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../store";
import { ensureCwd } from "./terminalSession";

function langOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
    java: "java", go: "go",
    py: "python", js: "javascript", ts: "typescript", tsx: "typescript",
    jsx: "javascript", rs: "rust", json: "json", md: "markdown",
    html: "html", css: "css", txt: "plaintext",
  };
  return map[ext] ?? "plaintext";
}

export default function EditorPane() {
  const t = useT();
  const editorFile = useApp((s) => s.editorFile);
  const nonce = useApp((s) => s.editorNonce);
  const saveNonce = useApp((s) => s.saveNonce);
  const completeSave = useApp((s) => s.completeSave);
  const vimEnabled = useApp((s) => s.vimEnabled);
  const workspace = useApp((s) => s.workspace);
  const setEditorContent = useApp((s) => s.setEditorContent);

  const [content, setContent] = useState("");
  const contentRef = useRef("");
  const fileRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const editorRef = useRef<any>(null);
  const vimRef = useRef<VimMode | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const mirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const seq = ++loadSeq.current;
    fileRef.current = null;
    dirtyRef.current = false;
    if (!editorFile) return;
    invoke<string>("read_file", { path: editorFile })
      .then((c) => {
        // 竞态防护：快速切换文件时，丢弃过期文件的读取结果
        if (seq !== loadSeq.current) return;
        setContent(c);
        contentRef.current = c;
        fileRef.current = editorFile;
        dirtyRef.current = false;
        setEditorContent(c);
      })
      .catch((e) => {
        if (seq !== loadSeq.current) return;
        setContent("// 读取失败: " + e);
      });
  }, [editorFile, nonce, setEditorContent]);

  const doSave = async (): Promise<boolean> => {
    const path = fileRef.current;
    const selected = useApp.getState();
    if (!path || selected.editorFile !== path) return false;
    const text = contentRef.current;
    const sequence = loadSeq.current;
    const editorNonce = selected.editorNonce;
    const pending = saveQueue.current.then(() => invoke("save_file", { path, content: text }));
    saveQueue.current = pending.catch(() => {});
    try {
      await pending;
      const current = useApp.getState();
      if (fileRef.current !== path || sequence !== loadSeq.current
        || current.editorFile !== path || current.editorNonce !== editorNonce) return false;
      // 写入期间继续输入时，保留脏标记，也不提交旧快照。
      const unchanged = contentRef.current === text;
      if (unchanged) dirtyRef.current = false;
      setSaveError(null);
      forceRender((n) => n + 1);
      return unchanged;
    } catch (e) {
      if (fileRef.current === path && sequence === loadSeq.current) {
        // Tauri WebView2 无 alert，错误直接显示在标签栏
        setSaveError(String(e).slice(0, 80));
        forceRender((n) => n + 1);
      }
      return false;
    }
  };

  // 一键运行：保存并等待工作区终端就绪后，把编译+运行命令写进终端
  const runFile = async () => {
    const path = fileRef.current;
    if (!path || !workspace || useApp.getState().editorFile !== path) return;
    const selectedNonce = useApp.getState().editorNonce;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!["c", "cpp", "py", "java", "go", "js"].includes(ext)) return;
    if (!(await doSave())) return;
    try {
      await ensureCwd(workspace);
    } catch (error) {
      setSaveError(String(error).slice(0, 80));
      forceRender((n) => n + 1);
      return;
    }
    const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
    const p = path.replace(/\//g, "\\");
    let run: string;
    if (ext === "py") {
      run = `python -X utf8 ${quote(p)}`;
    } else if (ext === "java") {
      // Java 入口类固定 Main：复制成 Main.java 编译，避开文件命名限制
      run = `chcp 65001 > $null; Copy-Item -LiteralPath ${quote(p)} -Destination "$env:TEMP\\Main.java" -Force; javac -encoding UTF-8 "$env:TEMP\\Main.java" -d "$env:TEMP"; if ($?) { java -cp "$env:TEMP" Main }`;
    } else if (ext === "go") {
      run = `chcp 65001 > $null; go run ${quote(p)}`;
    } else if (ext === "js") {
      run = `chcp 65001 > $null; node ${quote(p)}`;
    } else {
      const cc = ext === "c" ? "gcc" : "g++";
      const std = ext === "c" ? "-std=c17" : "-std=c++17";
      const exe = p.replace(/\.[^.]+$/, ".exe");
      run = `chcp 65001 > $null; ${cc} -O2 ${std} ${quote(p)} -o ${quote(exe)}; if ($?) { & ${quote(exe)} }`;
    }
    const cmd = `Set-Location -LiteralPath ${quote(workspace)} -ErrorAction Stop; if ($?) { ${run} }`;
    const current = useApp.getState();
    if (current.workspace !== workspace || current.editorFile !== path
      || current.editorNonce !== selectedNonce || fileRef.current !== path || dirtyRef.current) return;
    try {
      await invoke("pty_write", { data: cmd + "\r" });
    } catch (error) {
      setSaveError(String(error).slice(0, 80));
      forceRender((n) => n + 1);
    }
  };

  // 外部请求保存（判题前）：明确回报成功/失败，调用方不会靠固定延时猜保存状态。
  useEffect(() => {
    if (saveNonce <= 0) return;
    let cancelled = false;
    const save = doSave();
    save.then((succeeded) => {
      if (!cancelled) completeSave(saveNonce, succeeded);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveNonce]);

  // 练习代码自动保存：每 20 秒落盘一次脏内容（仅 practice 目录下的文件）
  useEffect(() => {
    const t = setInterval(() => {
      if (dirtyRef.current && fileRef.current?.includes("/practice/")) doSave();
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, doSave);
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => useApp.getState().requestJudge());
    if (useApp.getState().vimEnabled) {
      vimRef.current = initVimMode(editor, statusRef.current ?? undefined);
    }
  };

  // Vim 开关
  useEffect(() => {
    if (!editorRef.current) return;
    if (vimEnabled && !vimRef.current) {
      vimRef.current = initVimMode(editorRef.current, statusRef.current ?? undefined);
    } else if (!vimEnabled && vimRef.current) {
      vimRef.current.dispose();
      vimRef.current = null;
      if (statusRef.current) statusRef.current.textContent = "";
    }
  }, [vimEnabled]);

  if (!editorFile) {
    return <div className="pane-empty">{t("右侧是代码编辑器（Ctrl+S 保存，顶栏可切换 Vim 模式）")}</div>;
  }

  const name = editorFile.split(/[\\/]/).pop() ?? editorFile;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const runnable = ["c", "cpp", "py", "java", "go", "js"].includes(ext);
  return (
    <div className="editor-wrap">
      <div className="editor-tab">
        <span>{name}</span>
        {dirtyRef.current && <span className="dirty-dot"> ●</span>}
        {saveError && <span className="save-error" title={saveError}>{t("保存失败!")}</span>}
        {vimEnabled && <span className="vim-badge">VIM</span>}
        {runnable && (
          <button className="btn-sm run-btn" onClick={runFile} title={t("保存并编译运行到下方终端")}>
            ▶ 运行
          </button>
        )}
        <span className="run-hint">Ctrl+S 保存 · Ctrl+Enter 判题</span>
      </div>
      <div className="editor-host">
        <Editor
          language={langOf(editorFile)}
          theme="vs-dark"
          value={content}
          onMount={onMount}
        onChange={(v) => {
          contentRef.current = v ?? "";
          if (!dirtyRef.current) {
            dirtyRef.current = true;
            forceRender((n) => n + 1);
          }
          // 内容镜像防抖：避免每次按键触发全局重渲染（AI/判题在发送时才需要最新值）
          if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
          mirrorTimer.current = setTimeout(() => setEditorContent(contentRef.current), 400);
        }}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            fontFamily: "Consolas, 'Courier New', monospace",
            scrollBeyondLastLine: false,
          }}
        />
        <div className="vim-status" ref={statusRef} />
      </div>
    </div>
  );
}
