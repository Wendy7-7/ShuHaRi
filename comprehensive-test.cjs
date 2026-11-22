// 综合测试：教程/CTA/判题/徽章/chatSeed/主题/人格/帮助/新建文件 + 压力
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
let PASS = 0, FAIL = 0;
const check = (name, ok) => { if (ok) { PASS++; console.log(`  ✓ ${name}`); } else { FAIL++; console.log(`  ✗ ${name}`); } };

(async () => {
  // 前置重置：避免上个套件留下的解答污染本轮判题
  try { const q = JSON.parse(require("fs").readFileSync(WS + "/bank/c-001.json", "utf8")); require("fs").writeFileSync(WS + "/practice/c-001.c", q.starter_code); } catch {}

  const port = process.argv[2] || "9610";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") { console.log("  !! JS EXCEPTION:", (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 200)); } };
  let sawClose = false;
  ws.onclose = () => { sawClose = true; };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    // 阶段标记 + 拒绝捕获（带阶段名）
    await ev(`window.__phase = "init"; window.__rejs = []; window.addEventListener("unhandledrejection", (e) => { const r = e.reason; window.__rejs.push({ phase: window.__phase, msg: String((r && r.message) || r), stack: String((r && r.stack) || "").split("\\n").slice(0, 5).join(" | ") }); });`);
    const phase = (p) => ev(`window.__phase = ${JSON.stringify(p)}`);
    const realClick = async (sel, text) => {
      await ev("window.__cx=null");
      await ev(`(() => {
        const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
        const el = all.find(e => e.tagName === "BUTTON") || all[0];
        if (!el) return;
        const r = el.getBoundingClientRect();
        window.__cx = r.left + r.width / 2; window.__cy = r.top + r.height / 2;
      })()`);
      const x = await ev("window.__cx");
      if (x == null) return "NO-ELEMENT";
      const y = await ev("window.__cy");
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return "ok";
    };
    // 合成点击：确定性，不受事件管线抖动影响
    const syn = async (sel, text) =>
      ev(`(() => {
        const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
        const el = all.find(e => e.tagName === "BUTTON") || all[0];
        if (!el) return 0;
        el.click();
        return 1;
      })()`);

    await phase("A-tour");
    // ===== A. 教程全流程 + CTA =====
    console.log("== A. 教程 + CTA ==");
    await sleep(2000);
    let tourOpen = await ev(`!!document.querySelector(".tour-tip")`);
    check("教程自动弹出", tourOpen === true);
    for (let i = 0; i < 9; i++) { await syn(".tour-tip button", "下一步"); await sleep(220); if (sawClose) break; }
    await sleep(250);
    check("CTA 出现在最后一步", (await ev(`[...document.querySelectorAll(".tour-tip button")].some(b => b.textContent.includes("开始第一道题"))`)) === true);
    await syn(".tour-tip button", "开始第一道题");
    await sleep(3500);
    check("CTA 落地练习页+编辑器", (await ev(`document.querySelector(".editor-tab")?.textContent?.includes(".c") && !!document.querySelector(".q-count")`)) === true);

    await phase("B-judge");
    // ===== B. 判题 + 徽章 + chatSeed =====
    console.log("== B. 判题 + 徽章 + 一键求助 ==");
    await realClick(".q-actions button", "判题");
    let row = "none";
    for (let i = 0; i < 20; i++) { await sleep(1000); row = await ev(`document.querySelector(".judge-row")?.textContent?.slice(0, 30) ?? "none"`); if (row !== "none") break; }
    check("判题出结果", row !== "none");
    await sleep(500);
    check("徽章 toast 弹出", (await ev(`!!document.querySelector(".toast-pop")`)) === true);
    check("徽章 toast 文案含解锁", (await ev(`document.querySelector(".toast-pop")?.textContent?.includes("解锁徽章")`)) === true);
    const seedBtn = await syn(".judge-ai-btn", "");
    await sleep(700);
    const seedVal = await ev(`document.querySelector(".chat-input-row textarea")?.value?.slice(0, 30) ?? "no-textarea"`);
    check(`一键求助预填 (${String(seedVal).slice(0, 18)}...)`, String(seedVal).includes("判题失败"));
    await syn(".chat-head button", "×");
    await sleep(300);

    await phase("C-theme");
    // ===== C. 主题 + 人格 =====
    console.log("== C. 主题 + 教练人格 ==");
    await realClick(".topbar button", "设置");
    await sleep(700);
    await ev(`document.querySelectorAll(".swatch")[4]?.click()`);
    await sleep(300);
    check("紫色主题生效", (await ev(`getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()`)) === "#a78bfa");
    await ev(`(() => {
      const inputs = [...document.querySelectorAll(".settings-modal input")];
      const cn = inputs.find(i => (i.placeholder || "").includes("码灵"));
      if (cn) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(cn, "码灵"); cn.dispatchEvent(new Event("input", { bubbles: true })); }
    })()`);
    await ev(`(() => { const b = [...document.querySelectorAll(".modal-actions button")].find(x => x.textContent.includes("保存")); if (b) b.click(); })()`);
    await sleep(400);
    await realClick(".modal-mask", "");
    await sleep(300);
    await syn(".topbar button", "AI 助教");
    await sleep(600);
    check("教练名字生效(码灵)", (await ev(`document.querySelector(".chat-head span")?.textContent`)) === "码灵");
    const quickN = await ev(`document.querySelectorAll(".chat-quick .btn-sm").length`);
    const hasSetup = await ev(`!!document.querySelector(".ai-setup-card")`);
    check(`快捷按钮或 Key 引导卡（按钮 ${quickN} / 引导卡 ${hasSetup}）`, quickN >= 3 || hasSetup === true);
    await syn(".chat-head button", "×");
    await sleep(300);

    await phase("D-help-file");
    // ===== D. 帮助中心 + 新建文件 =====
    console.log("== D. 帮助 + 新建文件 ==");
    await syn(".nav-btn", "帮助");
    await sleep(800);
    check("帮助中心渲染", (await ev(`document.querySelectorAll(".help-section").length`)) >= 6);
    await syn(".help-view button", "重看新手教程");
    await sleep(600);
    check("教程可重开", (await ev(`!!document.querySelector(".tour-tip")`)) === true);
    await syn(".tour-tip button", "跳过");
    await sleep(300);
    await syn(".nav-btn", "学习");
    await sleep(600);
    await syn(".tree-actions .btn-sm", "＋");
    await sleep(500);
    await ev(`(() => { const i = document.querySelector(".newfile-modal input"); if (i) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, "stress-note-2.md"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`);
    await syn(".newfile-modal button", "创建");
    await sleep(700);
    check("新建文件出现在树中", (await ev(`[...document.querySelectorAll(".tree-node")].some(n => n.textContent.includes("stress-note-2.md"))`)) === true);

    await phase("E-stress");
    // ===== E. 压力测试 =====
    console.log("== E. 压力 ==");
    const views = ["学习", "题库练习", "错题本", "统计", "帮助"];
    let stressOK = true;
    for (let i = 0; i < 60; i++) {
      await realClick(".nav-btn", views[i % 5]);
      if (i % 6 === 0) await sleep(60);
      if (sawClose) { console.log(`  !! 第 ${i} 次切换时崩溃`); stressOK = false; break; }
    }
    check("60 次快速视图切换存活", stressOK && (await ev(`1`)) === 1);

    // 快速文件切换竞态
    await realClick(".nav-btn", "学习");
    await sleep(500);
    for (let i = 0; i < 6; i++) {
      await realClick(".tree-node", i % 2 === 0 ? "hello.c" : "c-basics.md");
      await sleep(120);
    }
    await sleep(1200);
    const finalTab = await ev(`document.querySelector(".editor-tab")?.textContent ?? ""`);
    check(`竞态后编辑器内容正确 (最终 tab: ${finalTab.slice(0, 12)})`, finalTab.includes("c-basics") || finalTab.includes("hello.c"));

    // 连续判题 busy 防抖
    await realClick(".nav-btn", "题库练习");
    await sleep(1500);
    await realClick(".q-item", "");
    await sleep(1500);
    await realClick(".q-actions button", "判题");
    await sleep(120);
    await realClick(".q-actions button", "判题");
    await sleep(120);
    await realClick(".q-actions button", "判题");
    let row2 = "none";
    for (let i = 0; i < 25; i++) { await sleep(1000); row2 = await ev(`document.querySelector(".judge-row")?.textContent?.slice(0, 20) ?? "none"`); if (row2 !== "none") break; }
    check("三连判题不炸且出结果", row2 !== "none");

    check("全程存活", !sawClose && (await ev(`1`)) === 1);
    const rejs = await ev("JSON.stringify(window.__rejs)");
    console.log("\n=== 未捕获拒绝汇总 ===");
    try { const arr = JSON.parse(rejs || "[]"); const byPhase = {}; arr.forEach(r => { byPhase[r.phase] = (byPhase[r.phase] || 0) + 1; }); console.log(JSON.stringify(byPhase)); if (arr.length) console.log("样本:", JSON.stringify(arr[0]).slice(0, 400)); } catch (e) { console.log("parse fail", e.message); }
    console.log(`\n===== 总结: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
