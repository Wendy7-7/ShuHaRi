import Editor, { type OnMount } from "@monaco-editor/react";
import { KeyMod, KeyCode } from "monaco-editor";
import { initVimMode, type VimMode } from "monaco-vim";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../store";

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
  const editorFile = useApp((s) => s.editorFile);
  const nonce = useApp((s) => s.editorNonce);
  const saveNonce = useApp((s) => s.saveNonce);
  const vimEnabled = useApp((s) => s.vimEnabled);
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!editorFile) return;
    const seq = ++loadSeq.current;
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

  const doSave = async () => {
    const path = fileRef.current;
    if (!path) return;
    try {
      await invoke("save_file", { path, content: contentRef.current });
      dirtyRef.current = false;
      setSaveError(null);
      forceRender((n) => n + 1);
    } catch (e) {
      // Tauri WebView2 无 alert，错误直接显示在标签栏
      setSaveError(String(e).slice(0, 80));
      forceRender((n) => n + 1);
    }
  };

  // 一键运行：保存后把编译+运行命令写进终端
  const runFile = () => {
    const path = fileRef.current;
    if (!path) return;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (!["c", "cpp", "py", "java", "go", "js"].includes(ext)) return;
    doSave();
    setTimeout(() => {
      const p = path.replace(/\//g, "\\");
      let cmd: string;
      if (ext === "py") {
        cmd = `python -X utf8 "${p}"`;
      } else if (ext === "java") {
        // Java 入口类固定 Main：复制成 Main.java 编译，避开文件命名限制
        // Java 21 默认 UTF-8（JEP 400），不再传 -Dfile.encoding（PowerShell 会传坏）
        cmd = `chcp 65001 > $null; Copy-Item "${p}" "$env:TEMP\\Main.java" -Force; javac -encoding UTF-8 "$env:TEMP\\Main.java" -d "$env:TEMP"; if ($?) { java -cp "$env:TEMP" Main }`;
      } else if (ext === "go") {
        cmd = `chcp 65001 > $null; go run "${p}"`;
      } else if (ext === "js") {
        cmd = `chcp 65001 > $null; node "${p}"`;
      } else {
        const cc = ext === "c" ? "gcc" : "g++";
        // 内置 MinGW g++ 8.1 只支持到 C++17
        const std = ext === "c" ? "-std=c17" : "-std=c++17";
        const exe = p.replace(/\.[^.]+$/, ".exe");
        // chcp 65001：避免 C 程序的中文输出在 GBK 控制台乱码
        cmd = `chcp 65001 > $null; ${cc} -O2 ${std} "\"${p}\"" -o "${exe}"; if ($?) { & "${exe}" }`;
      }
      invoke("pty_write", { data: cmd + "\r" }).catch(() => {});
    }, 400);
  };

  // 外部请求保存（判题前）
  useEffect(() => {
    if (saveNonce > 0 && dirtyRef.current) doSave();
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
    return <div className="pane-empty">右侧是代码编辑器（Ctrl+S 保存，顶栏可切换 Vim 模式）</div>;
  }

  const name = editorFile.split(/[\\/]/).pop() ?? editorFile;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const runnable = ["c", "cpp", "py", "java", "go", "js"].includes(ext);
  return (
    <div className="editor-wrap">
      <div className="editor-tab">
        <span>{name}</span>
        {dirtyRef.current && <span className="dirty-dot"> ●</span>}
        {saveError && <span className="save-error" title={saveError}>保存失败!</span>}
        {vimEnabled && <span className="vim-badge">VIM</span>}
        {runnable && (
          <button className="btn-sm run-btn" onClick={runFile} title="保存并编译运行到下方终端">
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
