import { useT } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../api";
import { useApp } from "../store";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

const GUIDED_PROMPT = `你是一位编程助教，学习者正在做题——他们很可能是自学，没有其他老师可问，所以要耐心、给安全感，但不要溺爱。严格遵守：
1. 永远不输出可直接提交的完整代码，包括拼起来能运行的片段
2. 每次回复只问一个问题，围绕学习者当前的卡点
3. 先让学习者说出思路，再指出思路中的第一个漏洞
4. 学习者连续 3 轮无进展时，给一条具体提示（如"检查循环边界"），仍不给代码
5. 判断依据优先级：学习者思路 > 当前代码 > 判题结果
6. 如果学习者的思路有根本性错误，直接指出来，不要委婉附和——真实的反馈比舒服的话更有价值
7. 如果提供了[判题结果]，以它为准分析，不要猜测代码"可能"的输出
8. 给提示时优先建议一个具体的自我调试动作（如"在循环里加一行打印 i 的值，再运行对比"），让学习者自己动手验证，而不是直接给结论
9. 当学习者表现出"只想拿到能跑的代码"的倾向时，温和提醒：现在跳过的思考，之后会连本带利补回来`;

const DIRECT_PROMPT = "你是一位耐心的编程助教，用简洁清晰的中文解答学习者的问题，可以给出代码示例。";

export default function ChatPanel() {
  const t = useT();
  const chatOpen = useApp((s) => s.chatOpen);
  const setChatOpen = useApp((s) => s.setChatOpen);
  const view = useApp((s) => s.view);
  const currentQuestion = useApp((s) => s.currentQuestion);
  const editorContent = useApp((s) => s.editorContent);
  const judgeResults = useApp((s) => s.judgeResults);
  const chatSeed = useApp((s) => s.chatSeed);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyMissing, setKeyMissing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** 学习者画像：打开面板时加载一次，注入上下文，让 AI 带着记忆教学 */
  const profileRef = useRef<string>("");
  /** 教练人格（用户自定义） */
  const personaRef = useRef<string>("");
  const [coachName, setCoachName] = useState("AI 助教");

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [messages, busy]);

  // 打开面板即检测是否已配置 Key，没配就直接引导（而不是等发送报错）；同时加载学习者画像
  useEffect(() => {
    if (!chatOpen) return;
    api.kvGet("ai_key").then((k) => setKeyMissing(!k || !k.trim())).catch(() => {});
    // 加载教练人格
    (async () => {
      try {
        const [name, style, nick] = await Promise.all([
          api.kvGet("ai_coach_name"),
          api.kvGet("ai_coach_style"),
          api.kvGet("nickname"),
        ]);
        if (name && name.trim()) setCoachName(name.trim());
        else setCoachName("AI 助教");
        const styleText: Record<string, string> = {
          gentle: "语气温和鼓励，多用肯定句；批评前先肯定学习者的努力。",
          strict: "语气严格直接，像一位负责任的教练，指出错误毫不留情但绝不辱骂。",
          funny: "语气轻松幽默，偶尔用程序员梗调节气氛，但内容必须专业严谨。",
          calm: "语气冷静克制，逻辑严密，像资深工程师做 code review。",
        };
        personaRef.current =
          `你的名字是「${name?.trim() || "AI 助教"}」。` +
          (style ? styleText[style] ?? "" : "语气温和鼓励。") +
          (nick?.trim() ? `学习者的昵称是「${nick.trim()}」，可以自然地用昵称称呼。` : "");
      } catch {
        personaRef.current = "";
      }
    })();
    (async () => {
      try {
        const [solvedRaw, mistakes] = await Promise.all([api.kvGet("solved_ids"), api.listMistakes()]);
        const solved: string[] = solvedRaw ? JSON.parse(solvedRaw) : [];
        const unresolved = mistakes.filter((m) => !m.resolved);
        const parts: string[] = [`已独立解决 ${solved.length} 道题`];
        if (unresolved.length > 0) {
          parts.push(`尚未攻克的题目：${unresolved.slice(0, 8).map((m) => m.question?.title ?? m.question_id).join("、")}${unresolved.length > 8 ? " 等" : ""}`);
        }
        if (solved.length === 0 && unresolved.length === 0) parts.push("刚开始使用，尚无学习记录");
        profileRef.current = `[学习者画像]\n${parts.join("；")}。请结合这个背景调整讲解的起点和难度。`;
      } catch {
        profileRef.current = "";
      }
    })();
  }, [chatOpen]);

  // 判题失败一键求助：预填问题
  useEffect(() => {
    if (chatOpen && chatSeed) {
      setInput(chatSeed);
      useApp.getState().setChatSeed(null);
    }
  }, [chatOpen, chatSeed]);

  if (!chatOpen) return null;

  /** 流式发送：首个字立刻上屏，逐块追加 */
  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);

    try {
      const guided = (await api.kvGet("ai_guided")) !== "0";
      let context = "";
      if (currentQuestion) {
        context += `\n\n[当前题目] ${currentQuestion.title}（${currentQuestion.lang}）\n${currentQuestion.statement_md}`;
      }
      if (editorContent.trim()) {
        context += `\n\n[学习者当前代码]\n${editorContent.slice(0, 3000)}`;
      }
      const jr = useApp.getState().judgeResults;
      if (jr && jr.length > 0) {
        context +=
          "\n\n[最近一次判题结果（真实执行数据）]\n" +
          jr
            .map(
              (r) =>
                `用例${r.index + 1}: ${r.status}（${r.time_ms}ms）` +
                (!r.pass ? ` | 期望输出: ${JSON.stringify(r.expected)} | 实际输出: ${JSON.stringify(r.actual)}` : ""),
            )
            .join("\n");
      }
      if (profileRef.current) context += `\n\n${profileRef.current}`;

      const history: Msg[] = messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      // 美赛 pandas 题目：加载专属教练提示词（分级提示 L1-L4、范围限定）
      let promptBody = guided ? GUIDED_PROMPT : DIRECT_PROMPT;
      if (currentQuestion?.tags?.includes("数学建模")) {
        try {
          const tp = await invoke<string>("read_file", {
            path: `${useApp.getState().workspace}/mcm/tutor_prompt.md`,
          });
          const m = tp.match(/```text([\s\S]*?)```/);
          promptBody = (m ? m[1].trim() : tp) + "\n\n" + promptBody;
        } catch {
          /* 提示词文件缺失则退回通用 */
        }
      }
      const sys = (personaRef.current ? personaRef.current + "\n" : "") + promptBody + context;

      setMessages((m) => [...m, { role: "assistant", content: "", streaming: true }]);
      await api.aiChatStream([{ role: "system", content: sys }, ...history], (delta) => {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last && last.streaming) copy[copy.length - 1] = { ...last, content: last.content + delta };
          return copy;
        });
      });
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.streaming) copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      });
      setKeyMissing(false);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Key")) setKeyMissing(true);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.streaming) {
          copy[copy.length - 1] = { role: "assistant", content: (last.content ? last.content + "\n\n" : "") + "⚠️ " + msg };
        } else {
          copy.push({ role: "assistant", content: "⚠️ " + msg });
        }
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-head">
        <span>{coachName}{view === "exam" ? "（考试中已禁用）" : ""}</span>
        <button className="btn-sm" onClick={() => setChatOpen(false)}>×</button>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {keyMissing && (
          <div className="ai-setup-card">
            <b>{t("还没有配置 AI 助教")}</b>
            <p>{t("在「设置」里填一个 OpenAI 兼容的 API Key（DeepSeek / GLM / Kimi 都可以），就能随时提问了。")}</p>
            <button className="btn-sm" onClick={() => useApp.getState().setSettingsOpen(true)}>
              去设置 →
            </button>
          </div>
        )}
        {messages.length === 0 && !keyMissing && (
          <div className="chat-empty">
            有问题就问。卡住的时候，试着先描述你的思路。
            <div className="chat-quick">
              {view !== "exam" && currentQuestion && (
                <>
                  <button className="btn-sm" onClick={() => send("这道题在考什么知识点？我应该从哪里入手？")}>
                    这道题考什么？
                  </button>
                  <button className="btn-sm" onClick={() => send("点评一下我现在的代码，指出可以改进的地方（不用给完整代码）。")}>
                    点评我的代码
                  </button>
                </>
              )}
              {view !== "exam" && judgeResults && judgeResults.some((r) => !r.pass) && (
                <button className="btn-sm" onClick={() => send("我刚判题失败了（结果在上下文里）。帮我分析：我的思路可能哪里错了？先问我一个问题。")}>
                  分析我的失败
                </button>
              )}
              <button className="btn-sm" onClick={() => send("给我出一道检查理解的小问题，看看我是否真的掌握了当前在学的内容。")}>
                考考我
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"chat-msg " + m.role}>
            {m.content}
            {m.streaming && <span className="stream-cursor">▌</span>}
          </div>
        ))}
        {busy && !messages.some((m) => m.streaming) && (
          <div className="chat-msg assistant typing">{t("思考中…")}</div>
        )}
      </div>
      <div className="chat-input-row">
        <textarea
          value={input}
          disabled={view === "exam" || busy}
          placeholder={view === "exam" ? "考试模式禁用 AI" : "输入问题…（Enter 发送，Shift+Enter 换行）"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // 回车直接发送（Shift+Enter 换行）；兼容中文输入法组词状态
            if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn-sm" disabled={view === "exam" || busy || !input.trim()} onClick={() => send()}>{t("发送")}</button>
      </div>
    </div>
  );
}
