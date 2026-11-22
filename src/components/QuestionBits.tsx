import type { Question } from "../api";
import { useApp } from "../store";

// 从 QuestionPanel 拆出的自展示子组件：零业务耦合，可独立复用
export function TodayTip({
  mistakes,
  nextUnsolved,
  onStart,
}: {
  mistakes: number;
  nextUnsolved: Question | undefined;
  onStart: (q: Question) => void;
}) {
  if (mistakes === 0 && !nextUnsolved) return null;
  return (
    <div className="today-tip">
      <span>🎯 今日建议：</span>
      {mistakes > 0 ? (
        <>
          <span>先攻克 {mistakes} 道错题——错过的题最值得练</span>
          <button className="btn-sm" onClick={() => useApp.getState().setView("mistakes")}>去错题本 →</button>
        </>
      ) : (
        <>
          <span>继续下一题：「{nextUnsolved?.title}」</span>
          <button className="btn-sm" onClick={() => nextUnsolved && onStart(nextUnsolved)}>开始 →</button>
        </>
      )}
    </div>
  );
}

export function ExamSummaryBanner() {
  const summary = useApp((s) => s.lastExamSummary);
  const setLastExamSummary = useApp((s) => s.setLastExamSummary);
  const setView = useApp((s) => s.setView);
  if (!summary) return null;
  return (
    <div className="q-notice exam-summary">
      <span style={{ flex: 1 }}>{summary}</span>
      <button className="btn-sm" onClick={() => { setLastExamSummary(null); setView("mistakes"); }}>
        去错题本 →
      </button>
      <button className="btn-sm" onClick={() => setLastExamSummary(null)}>知道了</button>
    </div>
  );
}

