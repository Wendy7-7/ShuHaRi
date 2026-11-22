import { create } from "zustand";
import { api } from "./api";
import type { Question, CaseResult, Exam } from "./api";

// 由后端 app_info 决定：便携版 = exe 同目录 workspace；普通版 = 用户目录 learn-workspace
export const DEFAULT_WORKSPACE = "";

export type View = "study" | "practice" | "exam" | "mistakes" | "stats" | "help";

/** 考试会话状态 */
export interface ExamSession {
  exam: Exam;
  questions: Question[];
  /** 每题判题结果（按 questionId） */
  results: Record<string, CaseResult[]>;
  startedAt: number;
}

function persistExam(s: ExamSession | null) {
  // 考试状态落库：应用重启后可续考，倒计时以 startedAt 为准不受刷新影响
  api
    .kvSet("active_exam", s ? JSON.stringify(s) : "")
    .catch(() => {});
}

interface AppState {
  workspace: string;
  view: View;
  readerFile: string | null;
  editorFile: string | null;
  editorNonce: number;
  /** 编辑器当前内容镜像（供 AI / 判题使用） */
  editorContent: string;
  /** 请求编辑器保存（判题前先落盘） */
  saveNonce: number;
  /** 请求判题（编辑器 Ctrl+Enter 触发） */
  judgeNonce: number;
  uiLang: "zh" | "en";
  variantRedo: string | null; // 变体重做中的题目 id
  /** 文件树刷新信号（练习/考试产生新文件后） */
  fileTreeNonce: number;
  vimEnabled: boolean;
  currentQuestion: Question | null;
  judgeResults: CaseResult[] | null;
  hintsRevealed: number;
  editorialRevealed: boolean;
  examSession: ExamSession | null;
  examCurrentIdx: number;
  /** 交卷后的结果摘要（跨视图显示） */
  lastExamSummary: string | null;
  chatOpen: boolean;
  /** 打开聊天时预填的问题（判题失败一键求助等场景） */
  chatSeed: string | null;
  /** 全局 toast 通知（徽章解锁等高光时刻） */
  toast: string | null;
  settingsOpen: boolean;
  onboardingOpen: boolean;

  setWorkspace: (w: string) => void;
  setView: (v: View) => void;
  openReader: (f: string) => void;
  openEditor: (f: string) => void;
  setEditorContent: (c: string) => void;
  requestSave: () => void;
  requestJudge: () => void;
  refreshFileTree: () => void;
  toggleVim: () => void;
  openQuestion: (q: Question) => void;
  setJudgeResults: (r: CaseResult[] | null) => void;
  revealHint: () => void;
  revealEditorial: () => void;
  startExam: (s: ExamSession) => void;
  setExamIdx: (i: number) => void;
  addExamResult: (qid: string, r: CaseResult[]) => void;
  endExam: () => void;
  setLastExamSummary: (s: string | null) => void;
  setChatOpen: (v: boolean) => void;
  setChatSeed: (s: string | null) => void;
  showToast: (msg: string) => void;
  setToast: (t: string | null) => void;
  setSettingsOpen: (v: boolean) => void;
  setOnboardingOpen: (v: boolean) => void;
}

export const useApp = create<AppState>((set, get) => ({
  workspace: DEFAULT_WORKSPACE,
  view: "study",
  readerFile: null,
  editorFile: null,
  editorNonce: 0,
  editorContent: "",
  saveNonce: 0,
  judgeNonce: 0,
  uiLang: "zh",
  variantRedo: null,
  fileTreeNonce: 0,
  vimEnabled: false,
  currentQuestion: null,
  judgeResults: null,
  hintsRevealed: 0,
  editorialRevealed: false,
  examSession: null,
  examCurrentIdx: 0,
  lastExamSummary: null,
  chatOpen: false,
  chatSeed: null,
  toast: null,
  settingsOpen: false,
  onboardingOpen: false,

  setWorkspace: (workspace) =>
    set({ workspace, readerFile: null, editorFile: null }),
  setView: (view) => set({ view }),
  openReader: (readerFile) => set({ readerFile }),
  openEditor: (editorFile) =>
    set((s) => ({ editorFile, editorNonce: s.editorNonce + 1 })),
  setEditorContent: (editorContent) => set({ editorContent }),
  requestSave: () => set((s) => ({ saveNonce: s.saveNonce + 1 })),
  requestJudge: () => set((s) => ({ judgeNonce: s.judgeNonce + 1 })),
  refreshFileTree: () => set((s) => ({ fileTreeNonce: s.fileTreeNonce + 1 })),
  toggleVim: () => set((s) => ({ vimEnabled: !s.vimEnabled })),
  openQuestion: (q) =>
    set({
      currentQuestion: q,
      judgeResults: null,
      hintsRevealed: 0,
      editorialRevealed: false,
    }),
  setJudgeResults: (judgeResults) => set({ judgeResults }),
  revealHint: () => set((s) => ({ hintsRevealed: Math.min(s.hintsRevealed + 1, s.currentQuestion?.hints.length ?? 0) })),
  revealEditorial: () => set({ editorialRevealed: true }),
  startExam: (examSession) => {
    persistExam(examSession);
    set({ examSession, view: "exam", examCurrentIdx: 0, judgeResults: null });
  },
  setExamIdx: (examCurrentIdx) => set({ examCurrentIdx, judgeResults: get().examSession?.results[get().examSession!.questions[examCurrentIdx]?.id] ?? null }),
  addExamResult: (qid, r) =>
    set((s) => {
      if (!s.examSession) return s;
      const results = { ...s.examSession.results, [qid]: r };
      const updated = { ...s.examSession, results };
      persistExam(updated);
      return { examSession: updated };
    }),
  endExam: () => {
    persistExam(null);
    set({ examSession: null, view: "practice", currentQuestion: null });
  },
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setChatSeed: (chatSeed) => set({ chatSeed }),
  showToast: (toast) => set({ toast }),
  setToast: (toast) => set({ toast }),
  setLastExamSummary: (lastExamSummary) => set({ lastExamSummary }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
}));
