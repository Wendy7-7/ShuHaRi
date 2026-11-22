import { useT } from "../i18n";
import { useEffect, useState } from "react";
import { api, type ExamResultRow, type MistakeRow } from "../api";
import { BADGES } from "./badges";

interface ExamDetailItem {
  question_id: string;
  passed: boolean;
  cases_passed: number;
  cases_total: number;
}

export default function StatsView() {
  const t = useT();
  const [results, setResults] = useState<ExamResultRow[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRow[]>([]);
  const [solvedCount, setSolvedCount] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [qTitles, setQTitles] = useState<Record<string, string>>({});
  const [openExam, setOpenExam] = useState<number | null>(null);

  useEffect(() => {
    api.listExamResults().then(setResults).catch(() => {});
    api.listMistakes().then(setMistakes).catch(() => {});
    api.kvGet("solved_ids").then((v) => setSolvedCount(v ? JSON.parse(v).length : 0)).catch(() => {});
    api.kvGet("badges").then((v) => setOwned(v ? JSON.parse(v) : [])).catch(() => {});
    api.kvGet("streak").then((v) => setStreak(parseInt(v ?? "0", 10))).catch(() => {});
    api
      .listQuestions()
      .then((qs) => {
        const map: Record<string, string> = {};
        qs.forEach((q) => (map[q.id] = q.title));
        setQTitles(map);
      })
      .catch(() => {});
  }, []);

  const totalExams = results.length;
  const avgScore = totalExams > 0
    ? Math.round((results.reduce((s, r) => s + (r.total > 0 ? r.score / r.total : 0), 0) / totalExams) * 100)
    : null;
  const unresolved = mistakes.filter((m) => !m.resolved);

  const byTag: Record<string, number> = {};
  for (const m of unresolved) {
    for (const t of m.question?.tags ?? ["未分类"]) {
      byTag[t] = (byTag[t] ?? 0) + 1;
    }
  }
  const tagRows = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxTag = tagRows[0]?.[1] ?? 1;

  return (
    <div className="page-view">
      <h2>{t("学习统计")}</h2>
      <div className="stats-cards">
        <div className="stat-card"><div className="stat-num">{solvedCount}</div><div>{t("已解决题目")}</div></div>
        <div className="stat-card"><div className="stat-num">{totalExams}</div><div>{t("完成考试")}</div></div>
        <div className="stat-card"><div className="stat-num">{avgScore === null ? "—" : avgScore + "%"}</div><div>{t("平均通过率")}</div></div>
        <div className="stat-card"><div className="stat-num">{unresolved.length}</div><div>{t("待攻克错题")}</div></div>
        <div className="stat-card"><div className="stat-num">{streak > 0 ? `${streak} 天` : "—"}</div><div>{t("连续学习")}</div></div>
        <div className="stat-card"><div className="stat-num">{owned.length}/{BADGES.length}</div><div>{t("徽章收集")}</div></div>
      </div>

      <div className="badge-wall">
        {BADGES.map((b) => {
          const has = owned.includes(b.id);
          return (
            <div key={b.id} className={"badge-card" + (has ? " owned" : "")} title={b.desc}>
              <span className="badge-icon">{has ? b.icon : "🔒"}</span>
              <span className="badge-name">{b.name}</span>
              <span className="badge-desc">{b.desc}</span>
            </div>
          );
        })}
      </div>

      <h3>{t("薄弱知识点（按未解决错题数）")}</h3>
      {tagRows.length === 0 ? (
        <p className="hint-text">{t("暂无数据。做错的题会按标签统计到这里。")}</p>
      ) : (
        <div className="tag-bars">
          {tagRows.map(([tag, n]) => (
            <div key={tag} className="tag-bar-row">
              <span className="tag-bar-label">{tag}</span>
              <div className="tag-bar-track">
                <div className="tag-bar-fill" style={{ width: `${(n / maxTag) * 100}%` }} />
              </div>
              <span className="tag-bar-num">{n}</span>
            </div>
          ))}
        </div>
      )}

      <h3>{t("考试通过率趋势")}</h3>
      {results.length === 0 ? (
        <p className="hint-text">{t("还没有考试记录，去「考试模式」来一场自测。")}</p>
      ) : (
        <div className="trend-chart">
          {results
            .slice(0, 8)
            .reverse()
            .map((r) => {
              const rate = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
              return (
                <div key={r.id} className="trend-col" title={`${r.title} ${r.score}/${r.total}（${rate}%）`}>
                  <span className="trend-val">{rate}%</span>
                  <div className="trend-bar-track">
                    <div
                      className="trend-bar-fill"
                      style={{ height: `${Math.max(rate, 3)}%` }}
                    />
                  </div>
                  <span className="trend-label">
                    {new Date(r.finished_at).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      <h3>{t("最近考试（点一行看逐题讲评）")}</h3>
      {results.length === 0 ? (
        <p className="hint-text">{t("还没有考试记录。")}</p>
      ) : (
        <table className="results-table">
          <thead><tr><th>{t("考试")}</th><th>{t("成绩")}</th><th>{t("时间")}</th></tr></thead>
          <tbody>
            {results.slice(0, 10).map((r) => {
              const expanded = openExam === r.id;
              let detail: ExamDetailItem[] = [];
              try {
                detail = JSON.parse(r.detail || "[]");
              } catch {
                detail = [];
              }
              return (
                <ExamRows
                  key={r.id}
                  r={r}
                  expanded={expanded}
                  detail={detail}
                  qTitles={qTitles}
                  onToggle={() => setOpenExam(expanded ? null : r.id)}
                />
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ExamRows({
  r,
  expanded,
  detail,
  qTitles,
  onToggle,
}: {
  r: ExamResultRow;
  expanded: boolean;
  detail: ExamDetailItem[];
  qTitles: Record<string, string>;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <>
      <tr className="exam-row" onClick={onToggle}>
        <td>{expanded ? "▾ " : "▸ "}{r.title}</td>
        <td className={r.score === r.total && r.total > 0 ? "pass" : ""}>{r.score}/{r.total}</td>
        <td>{new Date(r.finished_at).toLocaleString()}</td>
      </tr>
      {expanded && (
        <tr className="exam-detail-row">
          <td colSpan={3}>
            {detail.length === 0 ? (
              <p className="hint-text">{t("这场考试没有逐题数据。")}</p>
            ) : (
              <div className="exam-detail-list">
                {detail.map((d) => (
                  <div key={d.question_id} className={"exam-detail-item " + (d.passed ? "pass" : "fail")}>
                    <span className="exam-detail-mark">{d.passed ? "✓" : "✗"}</span>
                    <span className="exam-detail-title">{qTitles[d.question_id] ?? d.question_id}</span>
                    <span className="exam-detail-cases">{d.cases_passed}/{d.cases_total} 用例</span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
