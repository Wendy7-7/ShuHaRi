import { useEffect, useState } from "react";
import { api, type MistakeRow } from "../api";
import { useApp } from "../store";
import { openQuestionFile } from "./QuestionPanel";

export default function MistakesView() {
  const workspace = useApp((s) => s.workspace);
  const openEditor = useApp((s) => s.openEditor);
  const openQuestion = useApp((s) => s.openQuestion);
  const setView = useApp((s) => s.setView);
  const [rows, setRows] = useState<MistakeRow[]>([]);

  const refresh = () => api.listMistakes().then(setRows).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const practice = async (m: MistakeRow) => {
    if (!m.question) return;
    openQuestion(m.question);
    await openQuestionFile(m.question, workspace, openEditor);
    setView("practice");
  };

  const unresolved = rows.filter((r) => !r.resolved);
  const resolved = rows.filter((r) => r.resolved);

  return (
    <div className="page-view">
      <h2>错题本</h2>
      {unresolved.length === 0 && <p className="hint-text">没有待攻克的错题。做错的题会自动出现在这里。</p>}
      {unresolved.map((m) => (
        <div key={m.id} className="mistake-row">
          <div className="mistake-info">
            <b>{m.question?.title ?? m.question_id}</b>
            <span className="q-tag">{m.question?.lang ?? "?"}</span>
            <span className="mistake-reason">{m.reason}</span>
            <span className="mistake-date">{new Date(m.created_at).toLocaleString()}</span>
          </div>
          <div className="mistake-actions">
            <button className="btn-sm" onClick={() => practice(m)} disabled={!m.question}>重做</button>
            {(m.question?.variant_cases?.length ?? 0) > 0 && (
              <button
                className="btn-sm variant-btn"
                title="同样的知识点，换一组数据——防止背答案"
                onClick={async () => {
                  if (!m.question) return;
                  useApp.setState({ variantRedo: m.question.id });
                  openQuestion(m.question);
                  await openQuestionFile(m.question, workspace, openEditor);
                  setView("practice");
                }}
              >
                变体重做
              </button>
            )}
            <button className="btn-sm" onClick={async () => { await api.resolveMistake(m.id); refresh(); }}>已掌握</button>
          </div>
        </div>
      ))}
      {resolved.length > 0 && (
        <>
          <h3>已掌握（{resolved.length}）</h3>
          {resolved.map((m) => (
            <div key={m.id} className="mistake-row done">
              <div className="mistake-info"><b>{m.question?.title ?? m.question_id}</b></div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
