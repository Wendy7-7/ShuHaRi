import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../api";
import { useApp } from "../store";

/** 服务商预设：新手只需要选一个、贴一个 Key，其余全自动 */
const PRESETS: Record<
  string,
  { label: string; base: string; model: string; url: string; tip: string }
> = {
  glm: {
    label: "智谱 GLM",
    base: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    url: "https://open.bigmodel.cn",
    tip: "注册后点右上角头像 →「API Keys」→ 新建并复制。模型更新很快：默认名可用，也可到官网模型列表选最新的填进来。",
  },
  deepseek: {
    label: "DeepSeek",
    base: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    url: "https://platform.deepseek.com",
    tip: "注册后登录平台 → 左侧「API keys」→ 创建 → 复制。deepseek-chat 是动态别名，会自动指向官网当前推荐的最新模型。",
  },
  kimi: {
    label: "Kimi 月之暗面",
    base: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    url: "https://platform.moonshot.cn",
    tip: "注册后在「API Key 管理」→ 新建 → 复制。模型名以官网模型列表为准。",
  },
  custom: {
    label: "自定义（我知道自己在填什么）",
    base: "",
    model: "",
    url: "",
    tip: "",
  },
};

export default function SettingsDialog() {
  const open = useApp((s) => s.settingsOpen);
  const setOpen = useApp((s) => s.setSettingsOpen);
  const [preset, setPreset] = useState<string>("glm");
  const [base, setBase] = useState("");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [guided, setGuided] = useState(true);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  // 个性化
  const ACCENTS = ["#4fc1ff", "#4ade80", "#fb923c", "#f472b6", "#a78bfa", "#22d3ee"];
  const [accent, setAccent] = useState("#4fc1ff");
  const [nickname, setNickname] = useState("");
  const [coachName, setCoachName] = useState("");
  const [coachStyle, setCoachStyle] = useState("gentle");

  const applyAccent = (c: string) => {
    document.documentElement.style.setProperty("--accent", c);
    document.documentElement.style.setProperty("--accent-deep", c);
  };

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.kvGet("ai_base"),
      api.kvGet("ai_key"),
      api.kvGet("ai_model"),
      api.kvGet("ai_guided"),
      api.kvGet("ai_preset"),
      api.kvGet("accent"),
      api.kvGet("nickname"),
      api.kvGet("ai_coach_name"),
      api.kvGet("ai_coach_style"),
    ]).then(([b, k, m, g, p, ac, nick, cn, cs]) => {
      setBase(b ?? PRESETS.glm.base);
      setKey(k ?? "");
      setModel(m ?? PRESETS.glm.model);
      setGuided(g !== "0");
      const savedPreset = p ?? "glm";
      setPreset(PRESETS[savedPreset] ? savedPreset : (b ? "custom" : "glm"));
      if (ac) { setAccent(ac); applyAccent(ac); }
      setNickname(nick ?? "");
      setCoachName(cn ?? "");
      setCoachStyle(cs ?? "gentle");
    });
  }, [open]);

  if (!open) return null;

  const pickPreset = (name: string) => {
    setPreset(name);
    setTestResult(null);
    const p = PRESETS[name];
    if (p.base) {
      setBase(p.base);
      setModel(p.model);
    }
  };

  const save = async () => {
    await api.kvSet("ai_base", base.trim());
    await api.kvSet("ai_key", key.trim());
    await api.kvSet("ai_model", model.trim());
    await api.kvSet("ai_guided", guided ? "1" : "0");
    await api.kvSet("ai_preset", preset);
    await api.kvSet("nickname", nickname.trim());
    await api.kvSet("ai_coach_name", coachName.trim());
    await api.kvSet("ai_coach_style", coachStyle);
    setSaved(true);
    setTimeout(() => { setSaved(false); }, 1200);
  };

  const testConnection = async () => {
    // 测试前先保存当前输入，避免"填了没保存测不通"的困惑
    await save();
    setTesting(true);
    setTestResult(null);
    try {
      await api.aiChat([{ role: "user", content: "连接测试，请回复OK" }]);
      setTestResult("✓ 连接成功，AI 助教可以用了");
    } catch (e) {
      setTestResult("✗ " + String(e).slice(0, 140));
    } finally {
      setTesting(false);
    }
  };

  const cur = PRESETS[preset] ?? PRESETS.glm;

  return (
    <div className="modal-mask" onClick={() => setOpen(false)}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>个性化</h3>
        <label>主题色（点一下，整个应用跟着变）</label>
        <div className="swatch-row">
          {ACCENTS.map((c) => (
            <button
              key={c}
              className={"swatch" + (accent === c ? " on" : "")}
              style={{ background: c }}
              onClick={() => { setAccent(c); applyAccent(c); api.kvSet("accent", c).catch(() => {}); }}
              title={c}
            />
          ))}
          <input
            type="color"
            className="swatch-picker"
            value={accent}
            title="自定义任意颜色"
            onChange={(e) => { setAccent(e.target.value); applyAccent(e.target.value); api.kvSet("accent", e.target.value).catch(() => {}); }}
          />
        </div>
        <label>你的昵称（AI 教练会这样称呼你）</label>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="比如：阿迪、Captain Debug…" />
        <label>AI 教练的名字</label>
        <input value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="默认：AI 助教（比如叫它『码灵』『Debug 师傅』）" />
        <label>教练风格</label>
        <select value={coachStyle} onChange={(e) => setCoachStyle(e.target.value)}>
          <option value="gentle">温和鼓励型（多肯定，慢慢推）</option>
          <option value="strict">严格教练型（直接指出问题，绝不放水）</option>
          <option value="funny">幽默段子型（程序员梗管够，气氛拉满）</option>
          <option value="calm">冷静理工型（像资深工程师做 code review）</option>
        </select>

        <h3 style={{ marginTop: 20 }}>设置 · AI 助教</h3>

        <p className="hint-text">
          AI 助教需要一个"API Key"（一把钥匙，从 AI 公司官网申请）。照下面三步走：
        </p>

        <label>第 1 步：选一家 AI 服务商</label>
        <select value={preset} onChange={(e) => pickPreset(e.target.value)}>
          {Object.entries(PRESETS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {cur.tip && (
          <p className="hint-text">
            {cur.tip}
            {cur.url && (
              <>
                {" "}
                <button className="btn-sm help-link" onClick={() => openUrl(cur.url).catch(() => {})}>
                  打开官网 ↗
                </button>
              </>
            )}
          </p>
        )}

        <label>第 2 步：把官网复制来的 Key 粘贴到这里</label>
        <input value={key} onChange={(e) => setKey(e.target.value)} type="password" placeholder="粘贴到这个框里（就是一串字母数字组成的密码）" />

        {preset === "custom" && (
          <>
            <label>API 地址（高级）</label>
            <input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://..." />
            <label>模型名（高级）</label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型名" />
          </>
        )}

        <div className="check-row">
          <input id="guided" type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
          <label htmlFor="guided">引导模式（推荐）：AI 不直接给答案，用提问引导你自己想出来</label>
        </div>

        <p className="hint-text">
          第 3 步：点「测试连接」，看到 ✓ 就成功了。Key 只保存在你自己的电脑上。
        </p>

        <div className="modal-actions">
          <span className={"test-result " + (saved || testResult?.startsWith("✓") ? "pass" : "")}>
            {saved ? "已保存 ✓" : testing ? "测试中…" : testResult ?? ""}
          </span>
          <button className="btn-sm" onClick={testConnection} disabled={testing}>测试连接</button>
          <button onClick={save}>保存</button>
        </div>
        <VersionLine />
      </div>
    </div>
  );
}

function VersionLine() {
  const [info, setInfo] = useState<{ version: string; portable: boolean } | null>(null);
  useEffect(() => {
    api.appInfo().then(setInfo).catch(() => {});
  }, []);
  return (
    <p className="hint-text" style={{ marginTop: 14, opacity: 0.55, textAlign: "center", fontSize: 11 }}>
      ShuHaRi v{info?.version ?? "…"}{info?.portable ? " · 便携版" : ""} · 数据全部本地存储
    </p>
  );
}
