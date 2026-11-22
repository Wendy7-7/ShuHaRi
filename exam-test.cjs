// 考试全流程 E2E：开考 → 离开确认（接受/拒绝）→ 答题交卷 → 成绩入库
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = process.argv[2] || "9570";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  // 确认弹窗自动处理队列：每个弹窗按队列头部的 accept 值处理
  const dialogQueue = [];
  let dialogSeen = 0;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === "Page.javascriptDialogOpening") {
      dialogSeen++;
      const accept = dialogQueue.length ? dialogQueue.shift() : true;
      console.log(`  [dialog #${dialogSeen}] message="${(msg.params.message || "").slice(0, 60)}" -> accept=${accept}`);
      send("Page.handleJavaScriptDialog", { accept });
    }
  };

  ws.onopen = async () => {
    await send("Runtime.enable");
    await send("Page.enable");
    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) { console.log("!! EVAL FAIL:", JSON.stringify(r.result.exceptionDetails).slice(0, 250)); return null; }
      return r.result?.result?.value;
    };
    const realClick = async (sel, text) => {
      await evalJs("window.__cx = null; window.__cy = null");
      await evalJs(`(() => {
        const all = [...document.querySelectorAll(${JSON.stringify(sel)})]
          .filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
        let el = all.find(e => e.tagName === "BUTTON") || all[0] || null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        window.__cx = r.left + r.width / 2; window.__cy = r.top + r.height / 2;
      })()`);
      const x = await evalJs("window.__cx"), y = await evalJs("window.__cy");
      if (x == null) return "NO-ELEMENT";
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return "ok";
    };

    console.log("=== 准备：跳过教程、导入题库 ===");
    // 轮询等待教程出现并跳过（冷启动时 kvGet+600ms 可能较慢）
    let tourClosed = false;
    for (let i = 0; i < 8; i++) {
      await sleep(1000);
      const has = await evalJs(`!!document.querySelector(".tour-tip")`);
      if (has === false) { tourClosed = true; break; }
      const r = await realClick(".tour-tip button", "跳过");
      console.log(`  tour skip attempt ${i + 1}: ${r}`);
      await sleep(500);
      if ((await evalJs(`!!document.querySelector(".tour-tip")`)) === false) { tourClosed = true; console.log("  tour closed"); break; }
    }
    console.log("  tour closed:", tourClosed);
    await sleep(400);
    console.log("nav 题库练习:", await realClick(".nav-btn", "题库练习"));
    await sleep(2500);
    console.log("  practice:", await evalJs(`JSON.stringify({count: document.querySelector(".q-count")?.textContent, items: document.querySelectorAll(".q-item").length})`));

    console.log("=== 1. 开考 ===");
    await realClick(".nav-btn", "考试模式");
    await sleep(800);
    const setupInfo = await evalJs(`JSON.stringify({
      langs: [...document.querySelectorAll(".exam-setup select option")].map(o => o.value),
      hint: document.querySelector(".exam-setup .hint-text")?.textContent?.slice(0, 60) ?? "",
      err: document.querySelector(".exam-setup .q-notice")?.textContent?.slice(0, 120) ?? "",
    })`);
    console.log("  setup 状态:", setupInfo);
    console.log("  开始考试:", await realClick(".exam-setup button", "开始考试"));
    await sleep(1200);
    const cd = await evalJs(`document.querySelector(".countdown")?.textContent ?? "NO-COUNTDOWN"`);
    const err2 = await evalJs(`document.querySelector(".exam-setup .q-notice")?.textContent?.slice(0, 150) ?? ""`);
    console.log("  倒计时:", cd, "| 错误:", err2);

    console.log("=== 2. 考试中点导航 → 弹窗点「继续考试」（应留在考试） ===");
    await realClick(".nav-btn", "统计");
    await sleep(700);
    const modalShown = await evalJs(`!!document.querySelector(".modal")`);
    console.log("  确认弹窗出现:", modalShown === true ? "PASS" : "FAIL");
    await realClick(".modal button", "继续考试");
    await sleep(700);
    const stillExam = await evalJs(`!!document.querySelector(".countdown") && !document.querySelector(".modal")`);
    console.log("  仍在考试:", stillExam === true ? "PASS" : "FAIL");

    console.log("=== 3. 考试中点导航 → 弹窗点「放弃」（应放弃考试） ===");
    await realClick(".nav-btn", "统计");
    await sleep(700);
    await realClick(".modal button", "放弃考试并离开");
    await sleep(800);
    const examGone = await evalJs(`!document.querySelector(".countdown")`);
    const inStats = await evalJs(`!!document.querySelector(".page-view")`);
    console.log("  考试已放弃:", examGone === true && inStats === true ? "PASS" : "FAIL");

    console.log("=== 4. 重新开考 → 答一题 → 交卷 ===");
    await realClick(".nav-btn", "考试模式");
    await sleep(800);
    console.log("  setup2:", await evalJs(`!!document.querySelector(".exam-setup")`));
    await realClick(".exam-setup button", "开始考试");
    await sleep(1500);
    console.log("  countdown2:", await evalJs(`document.querySelector(".countdown")?.textContent ?? "NONE"`));
    console.log("  q-items:", await evalJs(`document.querySelectorAll(".q-item").length`));
    await realClick(".q-item", "");
    await sleep(2000);
    console.log("  editor tab:", await evalJs(`document.querySelector(".editor-tab")?.textContent?.slice(0, 40) ?? "none"`));
    console.log("  q-actions:", await evalJs(`[...document.querySelectorAll(".q-actions button")].map(b => b.textContent).join(",") || "none"`));
    console.log("  提交本题:", await realClick(".q-actions button", "提交本题"));
    let judgeRow = "none";
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      judgeRow = await evalJs(`document.querySelector(".judge-row")?.textContent?.slice(0, 40) ?? "none"`);
      const n = await evalJs(`document.querySelector(".q-notice")?.textContent?.slice(0, 80) ?? ""`);
      if (judgeRow !== "none" || n) { console.log(`  t+${i + 1}s judge=${judgeRow} notice=${n}`); if (judgeRow !== "none") break; }
    }
    console.log("  考试内判题:", judgeRow);
    console.log("  交卷:", await realClick(".q-toolbar button", "交卷"));
    await sleep(1500);
    const notice = await evalJs(`document.querySelector(".q-notice")?.textContent?.slice(0, 80) ?? "none"`);
    console.log("  交卷结果:", notice);

    console.log("=== 5. 成绩入库检查 ===");
    await realClick(".nav-btn", "统计");
    await sleep(1000);
    const stat = await evalJs(`[...document.querySelectorAll(".stat-card")].map(c => c.textContent).join(" | ")`);
    console.log("  统计卡片:", stat);
    const row = await evalJs(`document.querySelector(".results-table tbody tr")?.textContent?.slice(0, 60) ?? "no-rows"`);
    console.log("  最近考试行:", row);

    console.log("=== 6. 错题本应有记录 ===");
    await realClick(".nav-btn", "错题本");
    await sleep(800);
    const mistakes = await evalJs(`[...document.querySelectorAll(".mistake-row")].length`);
    console.log("  错题条数:", mistakes, mistakes > 0 ? "PASS" : "FAIL");

    console.log("=== EXAM E2E DONE ===");
    process.exit(0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
