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

/** 工作区变化时重启 PTY（终端内容保留，仅换 shell 的 cwd） */
export function ensureCwd(workspace: string): void {
  if (!started || currentCwd !== workspace) {
    currentCwd = workspace;
    started = true;
    invoke("pty_start", { shell: "powershell", cwd: workspace })
      .then(() => {
        // 新会话默认 30x120，立即同步回 xterm 的真实尺寸
        invoke("pty_resize", { rows: lastRows, cols: lastCols }).catch(() => {});
      })
      .catch(() => {});
  }
}

/** 手动重启终端（PTY 卡死/输出异常时自救用） */
export function restartTerminal(): void {
  term?.clear();
  invoke("pty_start", { shell: "powershell", cwd: currentCwd ?? undefined })
    .then(() => {
      invoke("pty_resize", { rows: lastRows, cols: lastCols }).catch(() => {});
    })
    .catch(() => {});
}
