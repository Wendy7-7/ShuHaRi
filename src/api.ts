import { invoke, Channel } from "@tauri-apps/api/core";

export interface TestCase {
  stdin: string;
  expected_stdout: string;
  timeout_ms?: number;
  match_mode?: "exact" | "contains";
  expect_file?: { path: string; min_bytes?: number; dpi?: number } | null;
  setup_sql?: string | null;
  input_assets?: { path: string; content: string }[];
  expect_json?: { path: string; value: unknown; abs_tol?: number; rel_tol?: number } | null;
  expect_csv?: {
    path: string;
    columns: string[];
    rows: Record<string, unknown>[];
    key_columns?: string[];
    abs_tol?: number;
    rel_tol?: number;
  } | null;
}

export interface Question {
  id: string;
  lang: string;
  title: string;
  difficulty: number;
  statement_md: string;
  starter_code: string;
  hints: string[];
  editorial_md: string;
  test_cases: TestCase[];
  variant_cases?: TestCase[];
  tags: string[];
  source?: string;
}

export interface CaseResult {
  index: number;
  pass: boolean;
  status: string;
  expected: string | null;
  actual: string | null;
  time_ms: number;
}

export interface Exam {
  id: number;
  title: string;
  lang: string;
  duration_min: number;
  question_ids: string[];
}

export interface ExamResultRow {
  id: number;
  exam_id: number;
  title: string;
  score: number;
  total: number;
  finished_at: string;
  detail: string;
}

export interface MistakeRow {
  id: number;
  question_id: string;
  reason: string;
  created_at: string;
  resolved: number;
  question: Question | null;
}

export interface AppInfo {
  version: string;
  portable: boolean;
  exeDir: string;
  dataDir: string;
  defaultWorkspace: string;
  toolDirs: string[];
}

export const api = {
  appInfo: () => invoke<AppInfo>("app_info"),
  kvGet: (key: string) => invoke<string | null>("kv_get", { key }),
  kvSet: (key: string, value: string) => invoke<void>("kv_set", { key, value }),
  listQuestions: (lang?: string) => invoke<Question[]>("list_questions", { lang: lang ?? null }),
  importBank: (dir: string) => invoke<number>("import_bank", { dir }),
  listLangpacks: () => invoke<any[]>("list_langpacks"),
  installLangpack: (zipPath: string) => invoke<any>("install_langpack", { zipPath }),
  uninstallLangpack: (packId: string) => invoke<any>("uninstall_langpack", { packId }),
  listCustomLangs: () => invoke<any[]>("list_custom_langs"),
  createExam: (lang: string, count: number, durationMin: number, title: string, createdAt: string) =>
    invoke<Exam>("create_exam", { lang, count, durationMin, title, createdAt }),
  saveExamResult: (examId: number, title: string, score: number, total: number,
    detail: { question_id: string; passed: boolean; cases_passed: number; cases_total: number }[],
    finishedAt: string) =>
    invoke<void>("save_exam_result", { examId, title, score, total, detail, finishedAt }),
  listExamResults: () => invoke<ExamResultRow[]>("list_exam_results"),
  addMistake: (questionId: string, reason: string, createdAt: string) =>
    invoke<void>("add_mistake", { questionId, reason, createdAt }),
  listMistakes: () => invoke<MistakeRow[]>("list_mistakes"),
  resolveMistake: (id: number) => invoke<void>("resolve_mistake", { id }),
  resolveMistakeByQuestion: (questionId: string) =>
    invoke<void>("resolve_mistake_by_question", { questionId }),
  judge: (codePath: string, lang: string, cases: TestCase[], workspaceRoot?: string) =>
    invoke<CaseResult[]>("judge", { codePath, lang, cases, workspaceRoot: workspaceRoot ?? null }),
  checkToolchain: () => invoke<Record<string, boolean>>("check_toolchain"),
  aiChat: (messages: { role: string; content: string }[]) =>
    invoke<string>("ai_chat", { messages }),
  aiChatStream: (messages: { role: string; content: string }[], onDelta: (s: string) => void) => {
    const ch = new Channel<string>();
    ch.onmessage = onDelta;
    return invoke<void>("ai_chat_stream", { messages, onChunk: ch });
  },
};

export const nowIso = () => new Date().toISOString();
