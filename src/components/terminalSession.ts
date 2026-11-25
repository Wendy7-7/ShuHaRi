import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * 终端单例：xterm 实例和 DOM 容器跨视图存活。
 * 切换视图只是把容器 DOM 挪进/挪出布局，PTY 和滚动缓冲不重建。
 */
let term: Terminal | null = null;
let fit: FitAddon | null = null;
let container: HTMLDivElement | null = null;
let ro: ResizeObserver | null = null;
let started = false;
let currentCwd: string | null = null;
let startPending: Promise<void> | null = null;
let startQueue: Promise<void> = Promise.resolve();
let lastRows = 30;
let lastCols = 120;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function attachTerminal(host: HTMLElement): void {
  if (!term) {
    const c = document.createElement("div");
    c.className = "terminal-host-inner";
    const t = new Terminal({
      fontSize: 13,
      fontFamily: "Consolas, 'Courier New', monospace",
      cursorBlink: true,
      theme: { background: "#1a1a1a" },
    });
    const f = new FitAddon();
    t.loadAddon(f);
    t.open(c);
    t.onData((d) => invoke("pty_write", { data: d }).catch(() => {}));
    listen<string>("pty-output", (e) => {
      term?.write(b64ToBytes(e.payload));
    });
    term = t;
    fit = f;
    container = c;
  }

  const c = container;
  if (!c || !fit || !term) return;
  const f = fit;
  const t = term;
  // 视图切换时 xterm 容器要搬家：先隐身，等 fit 完成再淡入，避免"跳一下又消失"的闪现
  c.style.opacity = "0";
  host.appendChild(c);
  requestAnimationFrame(() => {
    try {
      f.fit();
    } catch {
      /* 布局未就绪时忽略 */
    }
    t.refresh(0, t.rows - 1);
    requestAnimationFrame(() => {
      c.style.opacity = "1";
    });
  });

  ro?.disconnect();
  ro = new ResizeObserver(() => {
    try {
      fit?.fit();
    } catch {
      return;
    }
    if (term) {
      lastRows = term.rows;
      lastCols = term.cols;
      invoke("pty_resize", { rows: term.rows, cols: term.cols }).catch(() => {});
    }
  });
  ro.observe(host);
}

export function detachTerminal(): void {
  ro?.disconnect();
  ro = null;
  container?.remove();
}

function startTerminal(workspace: string): Promise<void> {
  currentCwd = workspace;
  started = false;
  const pending = startQueue.then(async () => {
    await invoke("pty_start", { shell: "powershell", cwd: workspace });
    // 尺寸同步失败不影响 PTY 已成功启动。
    await invoke("pty_resize", { rows: lastRows, cols: lastCols }).catch(() => {});
  });
  startPending = pending;
  // 失败后允许下一次启动重试；工作区切换的启动请求按顺序执行。
  startQueue = pending.catch(() => {});
  void pending.then(
    () => {
      if (startPending === pending) {
        startPending = null;
        started = true;
      }
    },
    () => {
      if (startPending === pending) {
        startPending = null;
        started = false;
      }
    },
  );
  return pending;
}

/** 工作区变化时重启 PTY；调用方可等待启动后再写入命令。 */
export function ensureCwd(workspace: string): Promise<void> {
  if (!workspace) return Promise.reject(new Error("工作区尚未就绪"));
  if (startPending && currentCwd === workspace) return startPending;
  if (started && currentCwd === workspace) return Promise.resolve();
  return startTerminal(workspace);
}

/** 手动重启终端（PTY 卡死/输出异常时自救用） */
export function restartTerminal(): void {
  if (!currentCwd) return;
  term?.clear();
  void startTerminal(currentCwd).catch(() => {});
}

/**
 * 读取终端最近若干行的纯文本（给"附上报错"按钮用）。
 * 只读缓冲区：不改用户选区、不动滚动位置、不触发重绘。
 */
export function getRecentTerminalOutput(maxLines = 80): string {
  const t = term;
  if (!t) return "";
  try {
    const buf = t.buffer.active;
    const total = buf.length;
    if (total === 0) return "";
    const start = Math.max(0, total - Math.max(1, maxLines));
    const lines: string[] = [];
    for (let i = start; i < total; i += 1) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    // 终端底部通常留着一堆空行，去掉尾部的
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines.join("\n");
  } catch {
    return "";
  }
}
