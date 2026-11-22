import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PdfReader from "./PdfReader";
import { useApp } from "../store";

export default function ReaderPane() {
  const readerFile = useApp((s) => s.readerFile);
  const view = useApp((s) => s.view);
  const currentQuestion = useApp((s) => s.currentQuestion);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!readerFile) return;
    setContent("加载中…");
    invoke<string>("read_file", { path: readerFile })
      .then(setContent)
      .catch((e) => setContent("**读取失败：** " + e));
  }, [readerFile]);

  // 练习/考试视图下左栏展示题目
  if ((view === "practice" || view === "exam") && currentQuestion) {
    return <QuestionStatement />;
  }

  if (!readerFile) {
    return <div className="pane-empty">双击文件树中的 .md 或 .pdf 文件，在这里看资料</div>;
  }
  if (/\.pdf$/i.test(readerFile)) {
    return <PdfReader key={readerFile} path={readerFile} />;
  }

  return (
    <div className="reader-scroll">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  );
}

export function QuestionStatement() {
  const q = useApp((s) => s.currentQuestion);
  if (!q) return <div className="pane-empty">从列表中选择一道题</div>;
  return (
    <div className="reader-scroll">
      <div className="q-meta">
        <span className="q-tag">{q.lang}</span>
        {q.tags.map((t) => (
          <span key={t} className="q-tag">{t}</span>
        ))}
        <span className="q-tag">难度 {q.difficulty}</span>
      </div>
      <Markdown remarkPlugins={[remarkGfm]}>{q.statement_md}</Markdown>
    </div>
  );
}
