import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../store";

interface TourStep {
  title: string;
  text: string;
  selector?: string;
}

const STEPS: TourStep[] = [
  {
    title: "欢迎使用 LearnPlatform",
    text: "这是一个「左书右码」的本地编程学习平台：左边看资料，右边写代码，底部跑终端，还带题库、考试和 AI 助教。花一分钟走完这个教程，就能上手了。",
  },
  {
    title: "顶栏",
    text: "学习 / 题库练习 / 错题本 / 统计 四大视图从这里切换；「考试模式」开考；右侧依次是 Vim 模式开关、AI 助教面板、设置（AI 的 API Key 在这里填）。",
    selector: ".topbar",
  },
  {
    title: "文件树",
    text: "双击 .md 或 .pdf 文件在左下角阅读；双击代码文件在右侧编辑器打开。放一本书、一份习题册，这里就是你的书桌。",
    selector: ".area-tree",
  },
  {
    title: "阅读区",
    text: "支持 Markdown 和 PDF，阅读进度自动保存——下次打开直接接着上次的位置继续。",
    selector: ".area-reader",
  },
  {
    title: "编辑器",
    text: "写代码的地方，和全世界最流行的 VS Code 用同一个内核，自动缩进、语法高亮都是自动的，不用设置任何东西。写完按 Ctrl+S 保存。练习题的代码每 20 秒还会自动保存一次，不怕丢。顶栏的 Vim 开关是给老程序员玩的，新手不用管。",
    selector: ".area-editor",
  },
  {
    title: "终端",
    text: "这个黑色窗口叫「终端」，是直接对电脑下命令的地方，现在不用学它怎么用。点编辑器上的「▶ 运行」按钮，就会自动在这里编译并运行你的代码，结果直接显示出来。",
    selector: ".area-terminal",
  },
  {
    title: "题库练习与考试模式",
    text: "题库练习：写完点「判题」，测试用例逐个比对，错了自动进错题本，卡住了可以逐条解锁提示、看题解。考试模式：加权抽题（错过的题权重更高）、屏蔽资料、倒计时、交卷出成绩——在校生当模拟考，自学者当阶段自测。中途关掉应用，重开还能续考，时间照算。",
  },
  {
    title: "错题本与统计",
    text: "做错的题自动汇总，可一键重做；统计页按标签展示你的薄弱知识点和最近成绩——它知道你哪里弱。",
  },
  {
    title: "AI 助教",
    text: "顶栏「设置」里选一家 AI 服务商、粘贴申请来的 Key，就有一位 24 小时家教了（申请步骤在设置页和「帮助」里都写得清清楚楚）。它默认不直接给答案，而是用提问引导你自己想出来——这对你真正学会最有用。",
  },
  {
    title: "开始学习吧",
    text: "建议的第一步：去「题库练习」做第一道 C 语言题，感受一下判题流程。这个教程可以随时从顶栏「帮助」重新打开。",
  },
];

export default function Onboarding() {
  const open = useApp((s) => s.onboardingOpen);
  const setOpen = useApp((s) => s.setOnboardingOpen);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // 行车记录仪：定位闪退/跳步问题
  useEffect(() => {
    console.log(`[TOUR] ${new Date().toISOString()} open=${open} step=${step}`);
    return () => console.log(`[TOUR] effect cleanup open=${open} step=${step}`);
  }, [open, step]);

  useEffect(() => {
    console.log("[TOUR] MOUNTED");
    return () => console.log("[TOUR] UNMOUNTED");
  }, []);

  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    const update = () => {
      const el = s.selector ? document.querySelector(s.selector) : null;
      if (el) {
        el.scrollIntoView({ block: "nearest" });
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };
    update();
    const t = setTimeout(update, 80);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      clearTimeout(t);
    };
  }, [step, open]);

  if (!open) return null;

  const cur = STEPS[step];
  const finish = () => {
    api.kvSet("onboarding_done", "1").catch(() => {});
    setOpen(false);
  };
  const next = () => {
    console.log(`[TOUR] NEXT clicked at step=${step}`);
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };
  // PM：教程终点直接把用户送到第一道题，不留"接下来干嘛"的真空
  const startFirstQuestion = async () => {
    api.kvSet("onboarding_done", "1").catch(() => {});
    setOpen(false);
    const { useApp } = await import("../store");
    const { openQuestionFile } = await import("./QuestionPanel");
    useApp.setState({ view: "practice" });
    try {
      // 题库首次导入是异步的，轮询等待就绪（最多 8 秒）
      let qs = await api.listQuestions("c");
      for (let i = 0; i < 16 && qs.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 500));
        qs = await api.listQuestions("c");
      }
      if (qs.length > 0) {
        const s = useApp.getState();
        s.openQuestion(qs[0]);
        await openQuestionFile(qs[0], s.workspace, s.openEditor);
      }
    } catch {
      /* 题库为空时停留在练习页，用户能看到导入提示 */
    }
  };

  const tipW = 340;
  const tipH = 220;
  let tipStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + tipH + 24 < window.innerHeight;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - tipW - 12);
    tipStyle = below
      ? { left, top: rect.bottom + 14, width: tipW }
      : { left, top: Math.max(12, rect.top - tipH - 14), width: tipW };
  } else {
    tipStyle = { left: "50%", top: "46%", transform: "translate(-50%,-50%)", width: 440 };
  }

  const px = (n: number) => `${n}px`;

  return (
    <div className="tour-layer">
      {rect ? (
        <>
          <div className="tour-mask" style={{ left: 0, top: 0, right: 0, height: px(rect.top) }} />
          <div className="tour-mask" style={{ left: 0, top: px(rect.bottom), right: 0, bottom: 0 }} />
          <div className="tour-mask" style={{ left: 0, top: px(rect.top), width: px(rect.left), height: px(rect.height) }} />
          <div className="tour-mask" style={{ left: px(rect.right), top: px(rect.top), right: 0, height: px(rect.height) }} />
          <div className="tour-hole" style={{ left: px(rect.left - 6), top: px(rect.top - 6), width: px(rect.width + 12), height: px(rect.height + 12) }} />
        </>
      ) : (
        <div className="tour-mask" style={{ inset: 0 }} />
      )}
      <div className="tour-tip" style={tipStyle}>
        <div className="tour-stepnum">
          第 {step + 1} / {STEPS.length} 步
        </div>
        <h3>{cur.title}</h3>
        <p>{cur.text}</p>
        <div className="tour-actions">
          <button className="btn-sm" onClick={finish}>跳过</button>
          <div className="tour-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={i === step ? "dot on" : "dot"} />
            ))}
          </div>
          {step > 0 && (
            <button className="btn-sm" onClick={() => setStep(step - 1)}>上一步</button>
          )}
          {step === STEPS.length - 1 ? (
            <>
              <button className="btn-sm" onClick={finish}>完成</button>
              <button className="tour-cta" onClick={startFirstQuestion}>🎯 开始第一道题</button>
            </>
          ) : (
            <button onClick={next}>下一步</button>
          )}
        </div>
      </div>
    </div>
  );
}
