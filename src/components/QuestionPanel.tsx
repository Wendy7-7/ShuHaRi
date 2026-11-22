import { useT } from "../i18n";
import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, nowIso, type Question } from "../api";
import { useApp } from "../store";
import { checkAndAward } from "./badges";
import { TodayTip, ExamSummaryBanner } from "./QuestionBits";
import LangPacksModal from "./LangPacksModal";

const EXT: Record<string, string> = { c: "c", cpp: "cpp", python: "py", java: "java", sql: "sql", go: "go", javascript: "js" };

export async function openQuestionFile(q: Question, workspace: string, openEditor: (f: string) => void) {
  const ext = EXT[q.lang] ?? q.lang; // 第三方语言：后缀默认为语言标识
  const path = `${workspace}/practice/${q.id}.${ext}`.replace(/\\/g, "/");
  try {
    await invokeRead(path);
  } catch {
    await import("@tauri-apps/api/core").then((m) =>
      m.invoke("save_file", { path, content: q.starter_code }),
    );
  }
  openEditor(path);
}
async function invokeRead(path: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_file", { path });
}

export default function QuestionPanel({ mode }: { mode: "practice" | "exam" }) {
  const t = useT();
  const workspace = useApp((s) => s.workspace);
  const openEditor = useApp((s) => s.openEditor);
  const currentQuestion = useApp((s) => s.currentQuestion);
  const openQuestion = useApp((s) => s.openQuestion);
  const judgeResults = useApp((s) => s.judgeResults);
  const setJudgeResults = useApp((s) => s.setJudgeResults);
  const hintsRevealed = useApp((s) => s.hintsRevealed);
  const revealHint = useApp((s) => s.revealHint);
  const editorialRevealed = useApp((s) => s.editorialRevealed);
  const revealEditorial = useApp((s) => s.revealEditorial);
  const requestSave = useApp((s) => s.requestSave);
  const editorFile = useApp((s) => s.editorFile);
  const examSession = useApp((s) => s.examSession);
  const addExamResult = useApp((s) => s.addExamResult);
  const endExam = useApp((s) => s.endExam);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [lang, setLang] = useState("c");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [solved, setSolved] = useState<string[]>([]);
  const [tools, setTools] = useState<Record<string, boolean> | null>(null);
  const [todayMistakes, setTodayMistakes] = useState(0);
  const [importNonce, setImportNonce] = useState(0);
  const [freeMode, setFreeMode] = useState(false);
  const [lastWasVariant, setLastWasVariant] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);
  const [customLangs, setCustomLangs] = useState<{ lang: string; display: string }[]>([]);
  useEffect(() => { api.listCustomLangs().then(setCustomLangs).catch(() => {}); }, [importNonce]);
  useEffect(() => { api.kvGet("free_mode").then((v) => setFreeMode(v === "1")).catch(() => {}); }, []);
  const judgeNonce = useApp((s) => s.judgeNonce);

  useEffect(() => {
    api
      .listMistakes()
      .then((ms) => setTodayMistakes(ms.filter((m) => !m.resolved).length))
      .catch(() => {});
  }, []);

  // 已解决题目（持久化）
  useEffect(() => {
    api.kvGet("solved_ids").then((v) => setSolved(v ? JSON.parse(v) : [])).catch(() => {});
  }, []);
  // 工具链状态：语言包安装/卸载后（importNonce 变化）必须重查，否则徽标不刷新
  useEffect(() => {
    api.checkToolchain().then(setTools).catch(() => setTools({}));
  }, [importNonce]);

  const markSolved = (qid: string) => {
    setSolved((prev) => {
      if (prev.includes(qid)) return prev;
      const next = [...prev, qid];
      api.kvSet("solved_ids", JSON.stringify(next)).catch(() => {});
      return next;
    });
    // 做对后自动解除错题本中该题的记录（学习闭环）
    api
      .resolveMistakeByQuestion(qid)
      .then(async () => {
        const news = await checkAndAward("mistake_clear");
        news.forEach((b) => useApp.getState().showToast(`${b.icon} 解锁徽章「${b.name}」—— ${b.desc}`));
      })
      .catch(() => {});
  };

  // 题库为空时自动导入默认 bank 文件夹
  useEffect(() => {
    api.listQuestions().then(async (all) => {
      if (all.length === 0) {
        try {
          const n = await api.importBank(`${workspace}/bank`.replace(/\\/g, "/"));
          setNotice(n > 0 ? t("已从 bank 导入 {n} 道题", { n }) : t("题库为空：请把题目 JSON 放入工作区 bank 文件夹"));
        } catch {
          setNotice(t("题库为空：请把题目 JSON 放入工作区 bank 文件夹"));
        }
      }
      api.listQuestions().then(setQuestions);
    });
  }, [workspace, importNonce]);

  const loadQuestion = useCallback(async (q: Question) => {
    setLastWasVariant(false);
    openQuestion(q);
    const s = useApp.getState();
    if (s.view === "exam" && s.examSession) {
      const idx = s.examSession.questions.findIndex((x) => x.id === q.id);
      if (idx >= 0) s.setExamIdx(idx);
    }
    await openQuestionFile(q, workspace, openEditor);
    useApp.getState().refreshFileTree();
  }, [workspace, openEditor, openQuestion]);

  const practiceList =
    lang === "pandas"
      ? questions.filter((q) => q.tags?.includes("pandas"))
      : lang === "matplotlib"
        ? questions.filter((q) => q.tags?.includes("matplotlib"))
        : lang === "stats"
          ? questions.filter((q) => q.tags?.includes("统计"))
          : questions.filter((q) => q.lang === lang);
  const examQuestions = examSession?.questions ?? [];

  // 编辑器 Ctrl+Enter 请求判题
  useEffect(() => {
    if (judgeNonce > 0 && currentQuestion) judge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [judgeNonce]);

  /** 工程师黑话翻译成人话：新手看到"未检测到 gcc"只会懵 */
  const friendlyJudgeError = (e: string): string => {
    if (e.includes("未检测到 gcc"))
      return t("⚠️ 你的电脑还没有安装 C 语言编译器，装好后就能判题了。👉 点顶栏「帮助」→ 环境体检，有手把手的安装教程。");
    if (e.includes("未检测到 g++"))
      return "⚠️ 还没有安装 C++ 编译器（g++）。\n👉 点顶栏「帮助」→ 环境体检，有安装教程。";
    if (e.includes("未检测到 python"))
      return "⚠️ 你的电脑还没有安装 Python。\n👉 点顶栏「帮助」→ 环境体检，有安装教程（记得勾选 Add to PATH）。";
    if (e.includes("未检测到 javac"))
      return "⚠️ 你的电脑还没有安装 JDK（Java 开发工具包）。\n👉 点顶栏「帮助」→ 环境体检，有安装教程（或直接用自带 JDK 的便携版）。";
    if (e.includes("未检测到 Go"))
      return "⚠️ 你的电脑还没有安装 Go。\n👉 点顶栏「帮助」→ 环境体检（便携版已自带 Go，无需安装）。";
    if (e.includes("未检测到 Node.js"))
      return "⚠️ 你的电脑还没有安装 Node.js。\n👉 点顶栏「帮助」→ 环境体检（便携版已自带 Node，无需安装）。";
    if (e.includes("编译超时")) return "⏳ 编译超时了，可能是电脑正忙，再点一次「判题」试试。";
    if (e.includes("编译失败")) return "❌ 代码编译没通过：通常是漏了分号、括号没配对或拼写错误。\n看报错的第一行，它告诉你第几行出了什么问题：\n\n" + e;
    return e;
  };

  const judge = async () => {
    const q = currentQuestion;
    if (!q || busy) return;
    // 考试时间截止后禁止继续提交
    if (mode === "exam" && examSession) {
      const deadline = examSession.startedAt + examSession.exam.duration_min * 60000;
      if (Date.now() > deadline) {
        setNotice(t("⏰ 考试时间已结束，无法继续提交，请点击「交卷」"));
        return;
      }
    }
    setBusy(true);
    setNotice(null);
    let passed = false;
    try {
      requestSave();
      await new Promise((r) => setTimeout(r, 350));
      // 变体重做：命中 store 标记的题目用变体用例（换数字防背答案）
      const useVariant = useApp.getState().variantRedo === q.id && (q.variant_cases?.length ?? 0) > 0;
      const cases = useVariant ? q.variant_cases! : q.test_cases;
      const results = await api.judge(editorFile ?? "", q.lang, cases);
      setLastWasVariant(useVariant);
      setJudgeResults(results);
      passed = results.length > 0 && results.every((r) => r.pass);

      const allPass = results.length > 0 && results.every((r) => r.pass);
      if (mode === "exam" && examSession) {
        addExamResult(q.id, results);
      } else if (allPass) {
        markSolved(q.id);
        if (useApp.getState().variantRedo === q.id) useApp.setState({ variantRedo: null }); // 变体通过即完成，清除标记
      } else {
        api.addMistake(q.id, t("判题未全过（{f}/{t} 用例失败）", { f: results.filter((r) => !r.pass).length, t: results.length }), nowIso()).catch(() => {});
      }
      // 徽章只奖励真实完成的判题（放在 try 内，编译失败等异常不发徽章）
      checkAndAward(passed ? "pass" : "judge").then((news) =>
        news.forEach((b) => useApp.getState().showToast(`${b.icon} 解锁徽章「${b.name}」—— ${b.desc}`)),
      );
    } catch (e) {
      setNotice(friendlyJudgeError(String(e)));
    } finally {
      setBusy(false);
    }
  };

  const submitExam = async () => {
    if (!examSession) return;
    const detail = examSession.questions.map((q) => {
      const rs = examSession.results[q.id];
      if (!rs || rs.length === 0) return { question_id: q.id, passed: false, cases_passed: 0, cases_total: q.test_cases.length };
      return {
        question_id: q.id,
        passed: rs.every((r) => r.pass),
        cases_passed: rs.filter((r) => r.pass).length,
        cases_total: rs.length,
      };
    });
    const score = detail.filter((d) => d.passed).length;
    try {
      await api.saveExamResult(examSession.exam.id, examSession.exam.title, score, examSession.questions.length, detail, nowIso());
      // 未交的题自动记入错题
      for (const d of detail) {
        if (!d.passed) api.addMistake(d.question_id, t("考试中未通过/未交卷"), nowIso()).catch(() => {});
      }
      // 结果摘要跨视图显示（交卷会切换视图，组件内 notice 会丢失）
      useApp.getState().setLastExamSummary(t("交卷完成：{s}/{n} 题通过，成绩已记录，错题已进错题本。", { s: score, n: examSession.questions.length }));
      endExam();
      checkAndAward("exam").then((news) =>
        news.forEach((b) => useApp.getState().showToast(`${b.icon} 解锁徽章「${b.name}」—— ${b.desc}`)),
      );
    } catch (e) {
      setNotice(String(e));
    }
  };

  const displayList = mode === "exam" ? examQuestions : practiceList;
  // 按知识点（第一个标签）分组，顺序接近学习路径
  const GROUP_ORDER = ["入门", "分支", "循环", "数组", "函数", "字符串", "数学", "数学建模", "SQL", "综合"];
  const groupedPractice: [string, Question[]][] = [];
  for (const q of practiceList) {
    const tag = q.tags?.[0] ?? "其他";
    const g = groupedPractice.find(([t]) => t === tag);
    if (g) g[1].push(q);
    else groupedPractice.push([tag, [q]]);
  }
  groupedPractice.sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a[0]);
    const ib = GROUP_ORDER.indexOf(b[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const nextUnsolved = practiceList.find((q) => !solved.includes(q.id));
  // 当前题之后的下一道未解决题（判题全过后引导前往）
  const nextUnsolvedAfter = (curId: string) => {
    const idx = practiceList.findIndex((q) => q.id === curId);
    const after = practiceList.slice(idx + 1).find((q) => !solved.includes(q.id));
    return after ?? practiceList.find((q) => !solved.includes(q.id) && q.id !== curId);
  };
  const statusOf = (q: Question): string => {
    if (mode === "exam") {
      const rs = examSession?.results[q.id];
      if (!rs || rs.length === 0) return "○";
      return rs.every((r) => r.pass) ? "✓" : "✗";
    }
    if (solved.includes(q.id)) return "✓";
    return currentQuestion?.id === q.id ? "•" : "";
  };

  return (
    <div className="question-panel">
      {mode === "practice" && tools && (!tools.gcc || !tools.python) && (
        <div className="env-banner">
          ⚠️ {t("判题环境不完整")}：{!tools.gcc && t("缺 gcc（C 语言）")}{!tools.gcc && !tools.python && "、"}{!tools.python && t("缺 python")}
          <button className="btn-sm" onClick={() => useApp.getState().setView("help")}>{t("去帮助看安装教程 →")}</button>
        </div>
      )}
      {mode === "practice" ? (
        <div className="q-toolbar">
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="pandas">pandas（美赛）</option>
            <option value="matplotlib">matplotlib（美赛）</option>
            <option value="stats">{t("统计（美赛）")}</option>
            <option value="sql">SQL</option>
            <option value="go">Go</option>
            <option value="javascript">JavaScript</option>
            {customLangs.map((c) => (
              <option key={c.lang} value={c.lang}>{c.display}</option>
            ))}
          </select>
          <button
            className="btn-sm import-bank-btn"
            title={t("从文件夹导入题库（每个 .json 一道题，或一个数组文件）")}
            onClick={async () => {
              const dir = await open({ directory: true });
              if (typeof dir !== "string") return;
              try {
                const n = await api.importBank(dir);
                useApp.getState().showToast(`⇪ 已导入 ${n} 道题`);
                useApp.getState().refreshFileTree();
                setImportNonce((v) => v + 1);
              } catch (e) {
                useApp.getState().showToast(`导入失败：${String(e)}`);
              }
            }}
          >
            {t("⇪ 导入")}
          </button>
          <button
            className={"btn-sm" + (freeMode ? " free-mode-on" : "")}
            title={freeMode ? t("自由模式：所有知识点不设解锁条件") : t("顺序解锁：上一组解决 2 题解锁下一组")}
            onClick={() => {
              const next = !freeMode;
              setFreeMode(next);
              api.kvSet("free_mode", next ? "1" : "0").catch(() => {});
              useApp.getState().showToast(next ? t("🚧 自由模式已开启：全部题目直接可做") : t("🔒 顺序解锁已开启：按知识点逐组推进"));
            }}
          >
            {freeMode ? t("自由模式") : t("顺序解锁")}
          </button>
          <button className="btn-sm" title={t("按需安装/卸载语言模块（Python、Java…），只占你要的磁盘")} onClick={() => setPacksOpen(true)}>{t("📦 语言包")}</button>
          <span className="q-count">
            {t("{n} 题 · 已解决 {m}", { n: practiceList.length, m: practiceList.filter((q) => solved.includes(q.id)).length })}
          </span>
          <span className="tool-badges">
            {tools && (
              <>
                <span className={"tool-chip " + (tools.gcc ? "ok" : "bad")}>gcc</span>
                <span className={"tool-chip " + (tools["g++"] ? "ok" : "bad")}>g++</span>
                <span className={"tool-chip " + (tools.python ? "ok" : "bad")}>python</span>
                <span className={"tool-chip " + (tools.java ? "ok" : "bad")}>java</span>
                <span className={"tool-chip " + (tools.go ? "ok" : "bad")}>go</span>
                <span className={"tool-chip " + (tools.node ? "ok" : "bad")}>node</span>
              </>
            )}
          </span>
        </div>
      ) : (
        <div className="q-toolbar">
          <span className="q-exam-title">{examSession?.exam.title ?? "考试"}</span>
          <button className="btn-sm submit" onClick={submitExam} disabled={!examSession}>{t("交卷")}</button>
        </div>
      )}

      {mode === "practice" && (
        <TodayTip mistakes={todayMistakes} nextUnsolved={nextUnsolved} onStart={loadQuestion} />
      )}

      <div className="q-list">
        {mode === "practice"
          ? groupedPractice.map(([tag, qs], gi) => {
              // 关卡式解锁：上一组解决 ≥2 题才解锁下一组（自由模式跳过）
              const prev = gi > 0 ? groupedPractice[gi - 1][1] : [];
              const prevSolved = prev.filter((x) => solved.includes(x.id)).length;
              const unlocked = freeMode || gi === 0 || prevSolved >= 2;
              return (
              <div key={tag}>
                <div className="q-group">{t(tag)}{!unlocked && <span className="lock"> 🔒 t("需上一组 ≥2 题")</span>}</div>
                {qs.map((q) => (
                  <div
                    key={q.id}
                    className={"q-item" + (currentQuestion?.id === q.id ? " active" : "") + (unlocked ? "" : " locked")}
                    onClick={() => {
                      if (!unlocked) {
                        setNotice(t("🔒 知识点「{tag}」还没解锁：先在「{prev}」里解决 2 道题。想自由练习？打开工具栏「自由模式」。", { tag, prev: groupedPractice[gi - 1][0] }));
                        return;
                      }
                      loadQuestion(q);
                    }}
                  >
                    <span className="q-status">{statusOf(q)}</span>
                    <span className="q-title">{q.title}</span>
                    <span className="q-diff">{"★".repeat(q.difficulty)}</span>
                  </div>
                ))}
              </div>
              );
            })
          : displayList.map((q) => (
              <div
                key={q.id}
                className={"q-item" + (currentQuestion?.id === q.id ? " active" : "")}
                onClick={() => loadQuestion(q)}
              >
                <span className="q-status">{statusOf(q)}</span>
                <span className="q-title">{q.title}</span>
                <span className="q-diff">{"★".repeat(q.difficulty)}</span>
              </div>
            ))}
        {displayList.length === 0 && <div className="pane-empty">{t("暂无题目")}</div>}
      </div>

      {currentQuestion && (
        <div className="q-actions">
          <button onClick={judge} disabled={busy || (mode === "exam" && !examSession)}>
            {busy ? "判题中…" : mode === "exam" ? "提交本题" : "判题"}
          </button>
          {mode === "practice" && currentQuestion.hints.length > 0 && hintsRevealed < currentQuestion.hints.length && (
            <button className="btn-sm" onClick={revealHint}>提示 {hintsRevealed + 1}/{currentQuestion.hints.length}</button>
          )}
          {mode === "practice" && !editorialRevealed && (
            <button className="btn-sm" onClick={revealEditorial}>{t("看题解")}</button>
          )}
        </div>
      )}

      {hintsRevealed > 0 && currentQuestion && (
        <div className="q-hints">
          {currentQuestion.hints.slice(0, hintsRevealed).map((h, i) => (
            <div key={i} className="q-hint">💡 {h}</div>
          ))}
        </div>
      )}

      {editorialRevealed && currentQuestion && (
        <div className="q-editorial">
          <MarkdownLite text={currentQuestion.editorial_md} />
        </div>
      )}

      {judgeResults && (
        <div className="judge-results">
          {judgeResults.map((r) => (
            <div key={r.index} className={"judge-row " + (r.pass ? "pass" : "fail")}>
              <span>用例 {r.index + 1}: {r.status}（{r.time_ms}ms）</span>
              {!r.pass && (
                <div className="judge-diff">
                  <div><b>{t("期望")}</b><pre>{r.expected}</pre></div>
                  <div><b>{t("实际")}</b><pre>{r.actual}</pre></div>
                </div>
              )}
            </div>
          ))}
          <div className={"judge-summary " + (judgeResults.every((r) => r.pass) ? "pass" : "fail")}>
            {judgeResults.filter((r) => r.pass).length}/{judgeResults.length} 用例通过
            {lastWasVariant && (
              <span className="variant-badge" title={t("本次判题使用变体数据")}>{t("变体")}</span>
            )}
            {judgeResults.some((r) => !r.pass) && mode === "practice" && (
              <button
                className="btn-sm judge-ai-btn"
                onClick={() => useApp.setState({ chatOpen: true, chatSeed: "我刚判题失败了（结果在上下文里）。帮我分析：我的思路可能哪里错了？先问我一个问题。" })}
              >
                🤖 让 AI 帮我分析
              </button>
            )}
            {judgeResults.every((r) => r.pass) && mode === "practice" && (
              <button
                className="btn-sm judge-review-btn"
                title={t("让 AI 点评你的代码风格，并告诉你这种写法在什么场景会翻车")}
                onClick={() => {
                  useApp.setState({ variantRedo: null });
                  useApp.setState({
                    chatOpen: true,
                    chatSeed: `我刚刚通过了「${currentQuestion?.title}」。请点评我当前代码的写法（不要给完整代码）：1) 哪里写得好；2) 哪里可以更简洁；3) 这种写法在什么场景会出问题；最后出一个检查理解的小问题。`,
                  });
                }}
              >
                ✨ AI 点评
              </button>
            )}
            {judgeResults.every((r) => r.pass) && mode === "practice" && currentQuestion && nextUnsolvedAfter(currentQuestion.id) && (
              <button
                className="btn-sm next-q-btn"
                onClick={() => {
                  const next = currentQuestion ? nextUnsolvedAfter(currentQuestion.id) : undefined;
                  if (next) loadQuestion(next);
                }}
              >
                下一题：「{currentQuestion ? nextUnsolvedAfter(currentQuestion.id)?.title : ""}」→
              </button>
            )}
          </div>
        </div>
      )}

      {notice && <div className="q-notice">{notice}</div>}

      {packsOpen && (
        <LangPacksModal
          onClose={() => setPacksOpen(false)}
          onChanged={() => { setImportNonce((v) => v + 1); useApp.getState().refreshFileTree(); }}
        />
      )}

      {mode === "practice" && <ExamSummaryBanner />}
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
  // 避免循环依赖，这里仅做简单渲染
  return <div className="reader-scroll">{text}</div>;
}
