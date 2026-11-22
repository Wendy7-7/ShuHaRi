import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api } from "../api";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export default function PdfReader({ path }: { path: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);
  const renderSeq = useRef(0);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const renderPage = useCallback(async (doc: pdfjs.PDFDocumentProxy, num: number) => {
    const seq = ++renderSeq.current;
    try {
      const p = await doc.getPage(num);
      const canvas = canvasRef.current;
      if (!canvas || seq !== renderSeq.current) return; // 已有更新的渲染请求，丢弃本次
      const containerW = canvas.parentElement?.clientWidth ?? 800;
      const base = p.getViewport({ scale: 1 });
      const scale = Math.max(0.5, (containerW - 24) / base.width);
      const viewport = p.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await p.render({ canvas, canvasContext: ctx, viewport } as any).promise;
    } catch (e) {
      if (seq === renderSeq.current) setError(String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setNumPages(0);
    docRef.current?.cleanup();
    docRef.current = null;

    (async () => {
      try {
        const saved = await api.kvGet(`pdf:${path}`);
        const doc = await pdfjs.getDocument({ url: convertFileSrc(path) }).promise;
        if (cancelled) {
          doc.cleanup();
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        const start = Math.min(Math.max(1, parseInt(saved ?? "1", 10) || 1), doc.numPages);
        setPage(start);
        await renderPage(doc, start);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      docRef.current?.cleanup();
      docRef.current = null;
    };
  }, [path, renderPage]);

  const go = async (n: number) => {
    const doc = docRef.current;
    if (!doc) return;
    const next = Math.min(Math.max(1, n), doc.numPages);
    setPage(next);
    await renderPage(doc, next);
    api.kvSet(`pdf:${path}`, String(next)).catch(() => {});
  };

  if (error) return <div className="pane-empty">PDF 加载失败：{error}</div>;

  return (
    <div className="pdf-wrap">
      <div className="pdf-bar">
        <button className="btn-sm" onClick={() => go(page - 1)} disabled={page <= 1}>◀</button>
        <span>{page} / {numPages || "…"}</span>
        <button className="btn-sm" onClick={() => go(page + 1)} disabled={page >= numPages}>▶</button>
        <span className="pdf-progress-note">阅读进度自动保存</span>
      </div>
      <div className="pdf-scroll">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
    </div>
  );
}
