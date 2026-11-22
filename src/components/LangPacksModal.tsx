import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../api";

interface PackInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  questions: number;
  runtime_present: boolean;
  runtime_mb: number;
}

/** 语言包管理：装哪个语言用哪个，省磁盘 */
export default function LangPacksModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [packs, setPacks] = useState<PackInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = () => api.listLangpacks().then(setPacks).catch(() => setPacks([]));
  useEffect(() => {
    refresh();
  }, []);

  const install = async () => {
    const p = await open({ filters: [{ name: "语言包", extensions: ["zip"] }] });
    if (typeof p !== "string") return;
    setBusy(true);
    setMsg("安装中…（大包可能要一两分钟）");
    try {
      const r = await api.installLangpack(p);
      setMsg(`✅ 已安装「${r.name}」：${r.imported} 道题入库`);
      await refresh();
      onChanged();
    } catch (e) {
      setMsg("❌ " + String(e));
    } finally {
      setBusy(false);
    }
  };

  const uninstall = async (id: string, name: string) => {
    if (!confirm(`确定卸载「${name}」？\n将删除：它的工具链目录 + 该语言的题目与错题记录。\n保留：学习资料（教程/数据集）。`)) return;
    setBusy(true);
    try {
      const r = await api.uninstallLangpack(id);
      setMsg(`🗑 已卸载「${id}」：移除 ${r.removedQuestions} 道题，释放约 ${r.freedMb}MB`);
      await refresh();
      onChanged();
    } catch (e) {
      setMsg("❌ " + String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal langpack-modal" onClick={(e) => e.stopPropagation()}>
        <h3>语言包管理</h3>
        <p className="hint-text">
          只装你要学的语言。语言包 zip 从项目的 GitHub Releases 下载（langpack-python.zip、langpack-java.zip…），
          点下面按钮从本地安装；不想要的随时卸载，磁盘只留给需要的东西。SQL 判题内置，无需安装。
        </p>
        {packs === null ? (
          <p className="hint-text">加载中…</p>
        ) : packs.length === 0 ? (
          <p className="hint-text">还没有安装任何语言包。</p>
        ) : (
          <table className="results-table" style={{ marginBottom: 10 }}>
            <thead>
              <tr>
                <th>语言包</th>
                <th>题目</th>
                <th>工具链</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b> <span className="q-tag">v{p.version}</span>
                    {p.description && <div className="hint-text" style={{ fontSize: 11 }}>{p.description}</div>}
                  </td>
                  <td>{p.questions}</td>
                  <td>{p.runtime_present ? `${p.runtime_mb}MB` : "（依赖本机环境）"}</td>
                  <td>
                    <button className="btn-sm" disabled={busy} onClick={() => uninstall(p.id, p.name)}>
                      卸载
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {msg && <p className="hint-text">{msg}</p>}
        <div className="modal-actions">
          <button className="btn-sm" onClick={onClose}>关闭</button>
          <button onClick={install} disabled={busy}>📦 从 zip 安装语言包</button>
        </div>
      </div>
    </div>
  );
}
