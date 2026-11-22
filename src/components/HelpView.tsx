import { useT } from "../i18n";
import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../api";
import { useApp } from "../store";

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="help-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function LinkBtn({ url, label }: { url: string; label: string }) {
  return (
    <button className="btn-sm help-link" onClick={() => openUrl(url).catch(() => {})}>
      {label} ↗
    </button>
  );
}

export default function HelpView() {
  const t = useT();
  const setOnboardingOpen = useApp((s) => s.setOnboardingOpen);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  const [tools, setTools] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    api.checkToolchain().then(setTools).catch(() => setTools({}));
  }, []);

  const toolRow = (name: string, ok: boolean | undefined, guide?: any) => (
    <div className="help-tool-row">
      <span className={"tool-chip " + (ok ? "ok" : "bad")}>{name}</span>
      {ok ? (
        <span className="help-ok">{t("已安装 ✓")}</span>
      ) : (
        <span className="help-missing">未安装 {guide}</span>
      )}
    </div>
  );

  return (
    <div className="page-view help-view">
      <h2>{t("帮助中心")}</h2>
      <p className="hint-text">
        把这页当成说明书：遇到任何"不会/不懂/报错了"，先来这里找。
      </p>

      <Section title="🚀 三步开始学习">
        <ol className="help-ol">
          <li><b>{t("看资料")}</b>：把学习材料（.md / .pdf）放进工作区文件夹，在左侧文件树双击打开阅读。</li>
          <li><b>{t("做题")}</b>：去「题库练习」→ 选一道题 → 代码写在下右侧编辑器 → 点「判题」。全部用例变绿就通过了。</li>
          <li><b>{t("检验")}</b>：去「考试模式」来一场测试。它对每个人意义不同：在校的同学当模拟考练手感，自学者当阶段自测摸底。做错的题自动进错题本，做对后自动移出。</li>
        </ol>
        <button className="btn-sm" onClick={() => setOnboardingOpen(true)}>
          📖 重看新手教程（10 步图解）
        </button>
      </Section>

      <Section title="🔑 AI 助教怎么配置（手把手版）">
        <p className="help-p">
          AI 助教就像请了一位 24 小时在线的家教。使用它需要一个"API Key"——你可以理解为<b>{t("一把钥匙")}</b>，
          从 AI 公司的官网申请，粘贴进本应用即可。全程不需要写任何代码。
        </p>
        <ol className="help-ol">
          <li>{t("点顶栏「设置」→ 在预设列表里选一家 AI 服务商（地址和模型会自动填好）。")}</li>
          <li>{t("点「打开官网」→ 注册账号 → 在官网找到「API Keys」页面 → 点「新建/创建」→ 复制那串以字母开头的长密码。")}</li>
          <li>{t("回到设置页，把复制的内容粘贴进「API Key」框 → 点「测试连接」→ 显示 ✓ 就成功了。")}</li>
        </ol>
        <p className="help-p">
          💡 创建 Key 本身一般不收费，实际用量计费以各官网为准；各家的模型和价格会随时变化，<b>{t("以官网当时公布为准")}</b>。
          不确定选哪家？把这个问题直接问任何一家 AI，它会给你最新的建议。
        </p>
        <p className="help-p">
          ⚠️ 2026 年研究的一个关键提醒：AI 的失败是<b>{t("静默")}</b>{t("的——它给出的代码可能能跑、看着合理，但做的是错的事。\n          所以在本应用里：")}<b>AI 说对了不算，判题器说了算</b>。任何代码改动，都以判题结果为最终裁判。
        </p>
        <button className="btn-sm" onClick={() => setSettingsOpen(true)}>{t("打开设置页配置 →")}</button>
      </Section>

      <Section title="🛠️ 环境体检（判题用）">
        <p className="help-p">
          「判题」功能需要你的电脑上装有编译器。当前状态：
        </p>
        {toolRow("gcc", tools?.gcc, <LinkBtn url="https://github.com/skeeto/w64devkit/releases" label="去下载 w64devkit" />)}
        <p className="help-p indent">
          C 语言编译器。推荐 w64devkit：下载 zip → 解压到任意文件夹 → 把里面的 <code>bin</code> 文件夹路径
          加入系统环境变量 Path → 重启本应用。看不懂没关系：把这句话发给 AI 助教，让它一步步带你装。
        </p>
        {toolRow("g++", tools?.["g++"], <span className="help-missing">（随 w64devkit 一起装好）</span>)}
        {toolRow("python", tools?.python, <LinkBtn url="https://www.python.org/downloads/" label="去下载 Python" />)}
        <p className="help-p indent">
          Python 官网下载安装时，<b>{t("务必勾选第一屏底部的「Add python.exe to PATH」")}</b>，否则装了也找不到。
        </p>
        {toolRow("java", tools?.java, <LinkBtn url="https://adoptium.net/zh-CN/temurin/releases/" label="去下载 JDK 21（Temurin）" />)}
        <p className="help-p indent">
          Java 判题需要 JDK（不是只装 JRE）。下载解压后把 JDK 的 <code>bin</code> 文件夹加入系统环境变量 Path，
          或直接把整个 JDK 文件夹放到程序目录的 <code>Runtime/jdk</code> 下（便携版已自带，无需这一步）。
        </p>
        <button className="btn-sm" onClick={() => api.checkToolchain().then(setTools)}>{t("重新检测")}</button>
      </Section>

      <Section title="📊 判题结果怎么看">
        <table className="help-table">
          <tbody>
            <tr><td className="pass">✓ 通过</td><td>{t("你的输出和标准答案完全一致，恭喜！")}</td></tr>
            <tr><td className="fail">{t("答案错误")}</td><td>{t("程序跑通了，但输出不对。对照\"期望/实际\"两栏找差异：多了空格？少了换行？")}</td></tr>
            <tr><td className="fail">{t("编译失败")}</td><td>{t("代码有语法错误，程序根本没跑起来。看报错")}<b>{t("第一行")}</b>：它告诉你第几行、什么问题。</td></tr>
            <tr><td className="fail">{t("超时")}</td><td>{t("程序陷入死循环（比如 while 条件永远为真），检查循环能不能退出。")}</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="🔥 常见报错速查">
        <table className="help-table">
          <tbody>
            <tr><td><code>expected ';' before ...</code></td><td>{t("上一行末尾忘了写分号")}</td></tr>
            <tr><td><code>expected declaration</code></td><td>大括号 {"}"} 少了一个，数一数配对</td></tr>
            <tr><td><code>undefined reference to `main`</code></td><td>{t("没有 main 函数，或 main 拼错了")}</td></tr>
            <tr><td><code>'printf' undeclared</code></td><td>{t("忘了写")}<code>#include &lt;stdio.h&gt;</code></td></tr>
            <tr><td><code>Segmentation fault</code></td><td>{t("数组越界或指针用错，检查下标范围")}</td></tr>
            <tr><td><code>error: class X is public, should be declared in a file named X.java</code></td><td>Java 入口类名和文件名不一致——本应用约定入口类固定叫 <code>Main</code></td></tr>
            <tr><td><code>NullPointerException</code></td><td>{t("用了还没赋值的对象（如数组元素、Scanner 之外的对象），检查哪里该 new 而没 new")}</td></tr>
            <tr><td>{t("输出中文变乱码")}</td><td>{t("点「▶ 运行」会自动处理；手动在终端跑的话先执行")}<code>chcp 65001</code></td></tr>
          </tbody>
        </table>
        <p className="help-p">{t("看不懂报错？直接把报错文字粘贴给 AI 助教，它会用你能懂的话解释。")}</p>
      </Section>

      <Section title="⌨️ 快捷键与编辑器">
        <table className="help-table">
          <tbody>
            <tr><td><code>Ctrl + S</code></td><td>{t("保存文件（不保存判题的就是旧代码！）")}</td></tr>
            <tr><td><code>Ctrl + Enter</code></td><td>{t("判题（练习做题时最快）")}</td></tr>
            <tr><td>▶ 运行</td><td>{t("把当前 C/C++/Python 文件编译并运行到下方终端，随便试代码用")}</td></tr>
          </tbody>
        </table>
        <p className="help-p">
          内置编辑器和全世界最流行的 VS Code 用的是同一个内核（Monaco），该有的自动缩进、语法高亮、
          错误提示全都有，开箱即用，不需要任何设置。顶栏的「Vim 开关」是给学过 Vim 的人准备的，
          <b>{t("新手完全不用管它")}</b>。
        </p>
      </Section>

      <Section title="🧭 2026 年的共识：怎么用 AI 才不会白学">
        <p className="help-p">
          近一年的实证研究（随机对照实验、372 所高校追踪研究）给出了明确结论：
          <b>{t("无约束地用 AI，短期效率翻倍，但之后脱离 AI 的独立调试失败率高达 77%")}</b>；
          而"带解释脚手架"地用 AI，失败率降到 39%，效率还不打折。差别不在用不用，而在<b>{t("怎么用")}</b>：
        </p>
        <ol className="help-ol">
          <li><b>{t("先挣扎 15 分钟")}</b>：卡住了先自己读报错、打印变量、做尝试，然后再问 AI——挣扎的过程就是学习本身。</li>
          <li><b>{t("要解释，不要代码")}</b>：问"为什么我的思路是错的"，而不是"给我能跑的代码"。本应用的引导模式默认就这样。</li>
          <li><b>{t("复述检查")}</b>：看完 AI 的解释，合上屏幕用自己的话讲一遍。讲不出来 = 没懂。</li>
          <li><b>{t("自己动手验证")}</b>：AI 建议加打印、改循环，就真的去改、去跑、去对比——判题器和终端都是你的裁判。</li>
          <li><b>{t("警惕\"能跑就是会了\"")}</b>：测试很简单——不看 AI，你能改动这代码的一个功能吗？不能的话，你拥有的是产品，不是技能。</li>
        </ol>
      </Section>

      <p className="hint-text" style={{ marginTop: 24 }}>
        这里没找到答案？把问题原样发给 AI 助教，或者截图发给你靠谱的学长。
      </p>
      <p className="hint-text" style={{ marginTop: 8, opacity: 0.5, fontSize: 11 }}>
        ShuHaRi v1.5.0 · 本地优先 · C / C++ / Python / Java 判题 · 数据全部在你自己的电脑（或 U 盘）里
      </p>
    </div>
  );
}
