import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import { useApp } from "../store";

const NAV: { key: "study" | "practice" | "mistakes" | "stats" | "help"; label: string }[] = [
  { key: "study", label: "学习" },
  { key: "practice", label: "题库练习" },
  { key: "mistakes", label: "错题本" },
  { key: "stats", label: "统计" },
  { key: "help", label: "帮助" },
];

export default function TopBar() {
  // 精准订阅：只在自己关心的切片变化时重渲染
  const workspace = useApp((s) => s.workspace);
  const setWorkspace = useApp((s) => s.setWorkspace);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const vimEnabled = useApp((s) => s.vimEnabled);
  const toggleVim = useApp((s) => s.toggleVim);
  const setChatOpen = useApp((s) => s.setChatOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const examSession = useApp((s) => s.examSession);
  const endExam = useApp((s) => s.endExam);
  // Tauri 的 WebView2 不支持 window.confirm，用应用内弹窗代替
  const [leaveTarget, setLeaveTarget] = useState<null | "study" | "practice" | "mistakes" | "stats" | "help">(null);

  const pickWorkspace = async () => {
    const dir = await open({ directory: true });
    if (typeof dir === "string" && dir) {
      setWorkspace(dir);
      // 记住用户手动选的工作区，下次启动恢复
      api.kvSet("workspace", dir).catch(() => {});
    }
  };

  const leaveFor = (key: "study" | "practice" | "mistakes" | "stats" | "help") => {
    if (examSession) {
      setLeaveTarget(key);
      return;
    }
    setView(key);
  };

  return (
    <div className="topbar">
      <span className="brand">LearnPlatform</span>
      <div className="nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={"nav-btn" + (view === n.key ? " active" : "")}
            onClick={() => leaveFor(n.key)}
          >
            {n.label}
          </button>
        ))}
        {examSession ? (
          <>
            <ExamCountdown />
            {view !== "exam" && (
              <button className="nav-btn exam" onClick={() => setView("exam")}>回到考试</button>
            )}
          </>
        ) : (
          <button className="nav-btn exam" onClick={() => setView("exam")}>考试模式</button>
        )}
      </div>
      <div className="spacer" />
      <button className="btn-sm" onClick={toggleVim}>{vimEnabled ? "Vim: 开" : "Vim: 关"}</button>
      <button className="btn-sm" onClick={() => setChatOpen(true)}>AI 助教</button>
      <button className="btn-sm" onClick={() => setSettingsOpen(true)}>设置</button>
      <span className="ws" title={workspace}>{workspace}</span>
      <button className="btn-sm" onClick={pickWorkspace}>打开工作区</button>

      {leaveTarget && (
        <div className="modal-mask" onClick={() => setLeaveTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>考试正在进行中</h3>
            <p className="hint-text">离开将放弃本次考试，已答题目按未交卷计。确定离开？</p>
            <div className="modal-actions">
              <button className="btn-sm" onClick={() => setLeaveTarget(null)}>继续考试</button>
              <button
                className="submit"
                onClick={() => {
                  const t = leaveTarget;
                  setLeaveTarget(null);
                  endExam();
                  if (t) setView(t);
                }}
              >
                放弃考试并离开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExamCountdown() {
  const startedAt = useApp((s) => s.examSession?.startedAt ?? 0);
  const durationMin = useApp((s) => s.examSession?.exam.duration_min ?? 0);
  const done = useApp((s) => Object.keys(s.examSession?.results ?? {}).length);
  const total = useApp((s) => s.examSession?.questions.length ?? 0);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = (Date.now() - startedAt) / 1000;
  const remain = Math.max(0, durationMin * 60 - elapsed);
  if (remain <= 0) {
    return <span className="countdown urgent">⏰ 时间到 · 请交卷</span>;
  }
  const mm = String(Math.floor(remain / 60)).padStart(2, "0");
  const ss = String(Math.floor(remain % 60)).padStart(2, "0");

  return (
    <span className={"countdown" + (remain <= 60 ? " urgent" : "")}>
      {mm}:{ss} · 已交 {done}/{total}
    </span>
  );
}
