import { useEffect, useRef } from "react";
import { attachTerminal, detachTerminal, ensureCwd, restartTerminal } from "./terminalSession";
import { useApp } from "../store";

export default function TerminalPane() {
  const hostRef = useRef<HTMLDivElement>(null);
  const workspace = useApp((s) => s.workspace);

  // 挂载/卸载：只挪 DOM，不重建终端
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    attachTerminal(host);
    ensureCwd(workspace);
    return () => detachTerminal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 工作区变化：重启 PTY 换 cwd
  useEffect(() => {
    ensureCwd(workspace);
  }, [workspace]);

  return (
    <div className="terminal-host-wrap">
      <div className="terminal-host" ref={hostRef} />
      <button className="term-restart" title="重启终端（终端卡死时点这里）" onClick={() => restartTerminal()}>
        ⟳
      </button>
    </div>
  );
}
