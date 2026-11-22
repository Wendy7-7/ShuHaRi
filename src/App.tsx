import { useEffect, lazy, Suspense } from "react";
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { invoke } from "@tauri-apps/api/core";
import TopBar from "./components/TopBar";
import SettingsDialog from "./components/SettingsDialog";
import ChatPanel from "./components/ChatPanel";
import Onboarding from "./components/Onboarding";
import FileTree from "./components/FileTree";
import ReaderPane from "./components/ReaderPane";
// Monaco 体积大：懒加载，首屏先渲染骨架，编辑器按需到位
const EditorPane = lazy(() => import("./components/EditorPane"));
import TerminalPane from "./components/TerminalPane";
import QuestionPanel from "./components/QuestionPanel";
import ExamSetup from "./components/ExamSetup";
import MistakesView from "./components/MistakesView";
import StatsView from "./components/StatsView";
import HelpView from "./components/HelpView";
import { touchStreak, checkAndAward } from "./components/badges";
import { useApp, type ExamSession } from "./store";
import { api } from "./api";
import "./App.css";

export default function App() {
  const view = useApp((s) => s.view);
  const examSession = useApp((s) => s.examSession);

  // 启动时恢复未完成的考试（倒计时按原 startedAt 续算）
  useEffect(() => {
    api
      .kvGet("active_exam")
      .then((raw) => {
        if (raw) {
          try {
            const session = JSON.parse(raw) as ExamSession;
            if (session?.exam && session?.questions?.length) {
              // 恢复未完成考试：自动回到考试视图，用户不用自己找"回到考试"按钮
              useApp.setState({ examSession: session, view: "exam" });
            }
          } catch {
            /* 损坏数据忽略 */
          }
        }
      })
      .catch(() => {});
  }, []);

  // 首次启动自动弹出上手教程；每次启动若阅读区为空则自动翻开 README
  useEffect(() => {
    // 恢复自定义主题色
    api.kvGet("accent").then((c) => {
      if (c) {
        document.documentElement.style.setProperty("--accent", c);
        document.documentElement.style.setProperty("--accent-deep", c);
      }
    }).catch(() => {});
    // 连续学习追踪 + 启动时补发漏掉的徽章
    (async () => {
      await touchStreak();
      const news = await checkAndAward("solve");
      news.forEach((b) => useApp.getState().showToast(`${b.icon} 解锁徽章「${b.name}」—— ${b.desc}`));
    })();
    api
      .kvGet("onboarding_done")
      .then((done) => {
        if (done !== "1") {
          setTimeout(() => {
            useApp.setState({ view: "study" });
            useApp.getState().setOnboardingOpen(true);
          }, 600);
        }
      })
      .catch(() => {});
    // 工作区由后端决定（便携版=exe 同目录 workspace）；若用户上次手动选过工作区则恢复它
    api
      .appInfo()
      .then(async (info) => {
        let ws = info.defaultWorkspace;
        try {
          const saved = await api.kvGet("workspace");
          if (saved && saved !== ws) {
            await invoke("list_dir", { path: saved }); // 目录已失效则回退默认
            ws = saved;
          }
        } catch {
          /* 保存的工作区失效，用默认 */
        }
        useApp.getState().setWorkspace(ws);
        useApp.setState({ readerFile: `${ws}/README.md` });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        {view === "study" && (
          <Allotment>
            <Allotment vertical defaultSizes={[180, 320]}>
              <div className="area-tree"><FileTree /></div>
              <div className="area-reader"><ReaderPane /></div>
            </Allotment>
            <Allotment vertical defaultSizes={[420, 220]}>
              <div className="area-editor"><Suspense fallback={<div className="pane-empty">编辑器加载中…</div>}><EditorPane /></Suspense></div>
              <div className="area-terminal"><TerminalPane /></div>
            </Allotment>
          </Allotment>
        )}

        {view === "practice" && (
          <Allotment>
            <Allotment vertical defaultSizes={[200, 280]}>
              <QuestionPanel mode="practice" />
              <ReaderPane />
            </Allotment>
            <Allotment vertical defaultSizes={[420, 220]}>
              <Suspense fallback={<div className="pane-empty">编辑器加载中…</div>}><EditorPane /></Suspense>
              <TerminalPane />
            </Allotment>
          </Allotment>
        )}

        {view === "exam" && !examSession && (
          <div className="center-wrap">
            <ExamSetup />
          </div>
        )}
        {view === "exam" && examSession && (
          <Allotment>
            <Allotment vertical defaultSizes={[200, 280]}>
              <QuestionPanel mode="exam" />
              <ReaderPane />
            </Allotment>
            <Allotment vertical defaultSizes={[420, 220]}>
              <Suspense fallback={<div className="pane-empty">编辑器加载中…</div>}><EditorPane /></Suspense>
              <TerminalPane />
            </Allotment>
          </Allotment>
        )}

        {view === "mistakes" && <MistakesView />}
        {view === "stats" && <StatsView />}
        {view === "help" && <HelpView />}
      </div>
      <ChatPanel />
      <SettingsDialog />
      <Onboarding />
      <Toast />
    </div>
  );
}

/** 全局 toast：徽章解锁等高光时刻 */
function Toast() {
  const toast = useApp((s) => s.toast);
  const setToast = useApp((s) => s.setToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  if (!toast) return null;
  return (
    <div className="toast-pop" onClick={() => setToast(null)}>
      {toast}
    </div>
  );
}
