import { useT } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../api";
import { useApp } from "../store";
import { getRecentTerminalOutput } from "./terminalSession";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

const GUIDED_PROMPT = `你是一位编程助教。学习者很可能是零基础自学、没有别的老师可问，所以要有耐心、给安全感，但不溺爱。

【第一步：先判断问题属于哪一类，再决定怎么答】
A. 环境类（ModuleNotFoundError、pip 报错、找不到 python、控制台乱码）
   → 直接给要执行的命令，不解释原理。写成"复制这一行，粘贴回车"。
B. 报错类（Traceback、KeyError、FileNotFoundError、IndentationError、TypeError）
   → 三句话：这是什么错 / 改哪一行改成什么 / 改完再跑一次。
C. 概念类（某某是什么、为什么要这样、两者区别）
   → 一句人话定义 + 一个最小例子 + 一个生活类比，总共不超过 5 行。
D. 代码类（帮我看看、为什么结果不对）
   → 只指出第一个错误，不要罗列十个问题。指出后让学习者自己改。
E. 方法论类（我该学什么、接下来做什么）
   → 给一个明确的下一步：今天做什么、做多久、做到什么算完成。

【第二步：一次只推进一个障碍】
- 学习者一次问了好几件事，先说"你问了三件，我们先解决最挡路的那件"，然后只答第一件。
- 不要把多个答案堆在一起——初学者会看晕，然后放弃。

【第三步：每个回答都以"现在做什么"结尾】
- 写成能立刻执行的动作："把第 3 行的引号改成英文引号，再运行一次"。
- 不要写"你应该理解……"，那没法执行。

【硬性纪律】
1. 永远不输出可直接提交的完整代码，包括拼起来就能跑的片段。
2. 判断依据优先级：学习者思路 > 当前代码 > 判题结果 > 你的推测。
3. 有 [最近一次判题结果] 或 [最近报错] 时以它为准，不要猜"可能"的输出。
4. 没实际运行过就不能说"运行结果是……"，应该说"跑一下，把输出贴给我"。
5. 学习者说"我不懂／好难"时，不要说"这很简单"，要说"卡在这里很正常，我们先做一件最小的事"。
6. 学习者问的如果是你已经讲过的内容，不要从头重讲：[教学状态] 里列了此前问过的话题，接着它往下讲深一层。
7. 学习者焦躁时停止追问，给一个 30 秒能跑通的小步骤，先恢复信心。
8. 不确定的 API 参数、库行为，直接说"我不确定，你打印出来看一下"或"查一下官方文档"，绝不编造。
9. 学习者只想拿能跑的代码时，温和提醒一句：现在跳过的思考，之后会连本带利补回来。
10. 提到某个方法时，补一句"这个在美赛里用在哪"，一句话即可。`;

const DIRECT_PROMPT = "你是一位耐心的编程助教，用简洁清晰的中文解答学习者的问题，可以给出代码示例。";

/** 单次请求的上下文预算（token 估算值）。deepseek-flash 支持 1M，这里留足余量。 */
const CONTEXT_BUDGET = 120_000;
/** 给模型输出（思考 + 回答）预留的空间 */
const OUTPUT_RESERVE = 12_000;
/** 压缩历史时，摘要的最长字符数 */
const DIGEST_LIMIT = 3_000;
/** 注入代码的硬上限（字符）。超大文件会被截断并标注，防止撑爆预算。 */
const MAX_CODE_CHARS = 200_000;

/** 粗略估算 token：CJK 字符按 1 个 token，其他字符按 1/4 个 token。 */
function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjk += 1;
    } else {
      other += 1;
    }
  }
  return cjk + Math.ceil(other / 4);
}

/** 教学状态：跨轮次保留，避免 AI 反复从头讲。 */
interface TeachState {
  /** 当前题目连续判题失败次数，用来决定提示级别 */
  failStreak: number;
  /** 提示级别 1–4 */
  hintLevel: number;
  /** 学习者问过的话题（最多保留 8 条，防止无限增长） */
  askedTopics: string[];
  /** 上次看到的判题结果签名；同一结果不重复计数 */
  lastJudgeSig: string;
}

const EMPTY_TEACH_STATE: TeachState = {
  failStreak: 0,
  hintLevel: 1,
  askedTopics: [],
  lastJudgeSig: "",
};

function normalizeTeachState(raw: unknown): TeachState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TEACH_STATE };
  const o = raw as Record<string, unknown>;
  const streak = Number(o.failStreak);
  const level = Number(o.hintLevel);
  const topics = Array.isArray(o.askedTopics)
    ? o.askedTopics.filter((t): t is string => typeof t === "string").slice(-8)
    : [];
  return {
    failStreak: Number.isFinite(streak) && streak > 0 ? Math.min(99, Math.floor(streak)) : 0,
    hintLevel: Number.isFinite(level) ? Math.min(4, Math.max(1, Math.floor(level))) : 1,
    askedTopics: topics,
    lastJudgeSig: typeof o.lastJudgeSig === "string" ? o.lastJudgeSig : "",
  };
}

/**
 * 从最近往前取历史消息，直到用完预算。
 * 放不下的更早消息压成一条摘要（每条取前 60 字），而不是直接丢掉。
 */
function buildHistoryWithinBudget(all: Msg[], budget: number): Msg[] {
  const picked: Msg[] = [];
  let used = 0;
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const m = all[i];
    if (m.streaming) continue;
    const cost = estimateTokens(m.content) + 8;
    if (used + cost > budget) {
      const rest = all.slice(0, i + 1).filter((x) => !x.streaming);
      if (rest.length === 0) break;
      let digest = rest
        .map((x) => `${x.role === "user" ? "问" : "答"}：${x.content.replace(/\s+/g, " ").slice(0, 60)}`)
        .join("\n");
      if (digest.length > DIGEST_LIMIT) digest = digest.slice(0, DIGEST_LIMIT) + "……";
      return [
        { role: "system", content: `[此前对话摘要，仅供衔接，细节以最新对话为准]\n${digest}` },
        ...picked,
      ];
    }
    picked.unshift(m);
    used += cost;
  }
  return picked;
}

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

      // —— 教学状态：跨轮次保留，避免反复从头讲 ——
      let teach: TeachState = { ...EMPTY_TEACH_STATE };
      try {
        const raw = await api.kvGet("teach_state");
        if (raw) teach = normalizeTeachState(JSON.parse(raw));
      } catch {
        teach = { ...EMPTY_TEACH_STATE };
      }
      const jr = useApp.getState().judgeResults;
      const judgeSig = jr && jr.length > 0 ? jr.map((r) => `${r.index}:${r.status}`).join("|") : "";
      // 只有判题结果真的变了才计数，避免学生连问几个问题时同一失败被重复累加
      if (jr && jr.length > 0 && judgeSig !== teach.lastJudgeSig) {
        teach.failStreak = jr.every((r) => r.pass) ? 0 : teach.failStreak + 1;
        if (teach.failStreak >= 2) teach.hintLevel = Math.max(teach.hintLevel, 2);
        if (teach.failStreak >= 4) teach.hintLevel = Math.max(teach.hintLevel, 3);
        teach.lastJudgeSig = judgeSig;
      }

      // —— 固定层：每次都带，代码不再截断 ——
      const fixed: string[] = [];
      if (currentQuestion) {
        fixed.push(`[当前题目] ${currentQuestion.title}（${currentQuestion.lang}）\n${currentQuestion.statement_md}`);
      }
      if (editorContent.trim()) {
        const code =
          editorContent.length > MAX_CODE_CHARS
            ? editorContent.slice(0, MAX_CODE_CHARS) +
              `\n……（代码过长已截断，原始共 ${editorContent.length} 字符）`
            : editorContent;
        fixed.push(`[学习者当前代码]\n${code}`);
      }
      if (jr && jr.length > 0) {
        fixed.push(
          "[最近一次判题结果（真实执行数据）]\n" +
            jr
              .map(
                (r) =>
                  `用例${r.index + 1}: ${r.status}（${r.time_ms}ms）` +
                  (!r.pass ? ` | 期望输出: ${JSON.stringify(r.expected)} | 实际输出: ${JSON.stringify(r.actual)}` : ""),
              )
              .join("\n"),
        );
      }
      if (profileRef.current) fixed.push(profileRef.current);

      const stateLines = [
        `当前提示级别：L${teach.hintLevel}（1 反问 / 2 指方法 / 3 给片段 / 4 完整答案并要求重写）`,
      ];
      if (teach.failStreak > 0) stateLines.push(`当前题目已连续失败 ${teach.failStreak} 次`);
      if (teach.askedTopics.length > 0) {
        stateLines.push(`学习者此前问过：${teach.askedTopics.join("、")}（不要从头重讲）`);
      }
      const openFile = useApp.getState().editorFile;
      if (openFile) stateLines.push(`当前打开的文件：${openFile}`);
      fixed.push(`[教学状态]\n${stateLines.join("\n")}`);

      const fixedText = fixed.join("\n\n");

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

      const sysBase = (personaRef.current ? personaRef.current + "\n" : "") + promptBody;
      const budget = Math.max(
        2_000,
        CONTEXT_BUDGET - OUTPUT_RESERVE - estimateTokens(sysBase) - estimateTokens(fixedText),
      );
      // messages 是本次渲染的快照，不含刚才 push 的这条用户消息，这里显式补上，
      // 否则模型收不到学习者当前的问题。
      const history = buildHistoryWithinBudget([...messages, { role: "user", content: text }], budget);
      const sys = sysBase + "\n\n" + fixedText;

      // 记录本轮话题，供下一轮避免重复
      const topic = text.replace(/\s+/g, " ").slice(0, 24);
      if (topic) teach.askedTopics = [...teach.askedTopics, topic].slice(-8);
      void api.kvSet("teach_state", JSON.stringify(teach)).catch(() => {});

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

  /** 把终端最近输出填进输入框（可继续编辑再发），解决"AI 看不到报错"。 */
  const attachTerminalError = () => {
    const raw = getRecentTerminalOutput(80);
    const tail = raw.trim() ? raw.split("\n").slice(-40).join("\n") : "";
    setInput((prev) => {
      if (!tail) {
        return prev.trim() ? prev : "我想把终端报错发给你，但终端里现在没有内容。";
      }
      const block = "```\n" + tail + "\n```";
      return prev.trim()
        ? `${prev}\n\n${block}`
        : `帮我看看这个报错：\n\n${block}\n\n（下面补充：我做了什么、期望看到什么）`;
    });
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
      {view !== "exam" && (
        <div className="chat-tools">
          <button
            className="btn-sm"
            onClick={attachTerminalError}
            title="把终端最近 40 行输出附到输入框，你可以再补充说明"
          >
            附上终端报错
          </button>
        </div>
      )}
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
