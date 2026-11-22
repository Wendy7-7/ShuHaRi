import { useEffect, useState } from "react";
import { api, nowIso, type Question } from "../api";
import { useApp } from "../store";

export default function ExamSetup() {
  const startExam = useApp((s) => s.startExam);
  const [lang, setLang] = useState("c");
  const [count, setCount] = useState(3);
  const [duration, setDuration] = useState(30);
  const [bank, setBank] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listQuestions().then(setBank).catch((e) => setError(String(e)));
  }, []);

  const langs = [...new Set(bank.map((q) => q.lang))];
  const available = bank.filter((q) => q.lang === lang).length;

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const exam = await api.createExam(lang, count, duration, "", nowIso());
      const all = await api.listQuestions(lang);
      const questions = exam.question_ids
        .map((id) => all.find((q) => q.id === id))
        .filter((q): q is Question => !!q);
      startExam({ exam, questions, results: {}, startedAt: Date.now() });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="exam-setup">
      <h2>创建考试</h2>
      <p className="hint-text">
        从题库加权抽题（错过的题权重更高）。考试中左栏只显示题目，AI 助教禁用，倒计时结束前交卷。
        在校生可以拿它当<b>模拟考</b>，自学者当<b>阶段自测</b>——练没练会，测一下才知道。
      </p>
      <div className="form-row">
        <label>语言</label>
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {langs.map((l) => <option key={l} value={l}>{l}</option>)}
          {langs.length === 0 && <option value="c">c</option>}
        </select>
      </div>
      <div className="form-row">
        <label>题量（可用 {available} 题）</label>
        <input type="number" min={1} max={20} value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))} />
      </div>
      <div className="form-row">
        <label>时长（分钟）</label>
        <input type="number" min={5} max={240} value={duration}
          onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 5))} />
      </div>
      {error && <div className="q-notice">{error}</div>}
      <button onClick={begin} disabled={busy || available === 0}>
        {busy ? "抽题中…" : "开始考试"}
      </button>
    </div>
  );
}
