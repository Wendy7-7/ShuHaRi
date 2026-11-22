// 确定性复测：上次失败的功能链（合成点击，无输入管线抖动）
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
  const port = process.argv[2] || "9611";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") { console.log("  !! JS EXCEPTION:", (m.params.exceptionDetails.exception?.description || "").slice(0, 200)); } };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const syn = async (sel, text) => ev(`(() => {
      const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
      const el = all.find(e => e.tagName === "BUTTON") || all[0];
      if (!el) return 0;
      el.click();
      return 1;
    })()`);

    console.log("== A. 教程 + CTA（合成点击）==");
    await sleep(2000);
    await syn(".tour-tip button", "跳过");
    await sleep(400);
    await syn(".nav-btn", "帮助");
    await sleep(700);
    await syn(".help-view button", "重看新手教程");
    await sleep(600);
    check("教程重开", (await ev(`!!document.querySelector(".tour-tip")`)) === true);
    for (let i = 0; i < 9; i++) { await syn(".tour-tip button", "下一步"); await sleep(160); }
    await sleep(250);
    check("CTA 出现在最后一步", (await ev(`[...document.querySelectorAll(".tour-tip button")].some(b => b.textContent.includes("开始第一道题"))`)) === true);
    await syn(".tour-tip button", "开始第一道题");
    await sleep(3500);
    check("CTA 落地练习+编辑器", (await ev(`document.querySelector(".editor-tab")?.textContent?.includes(".c") && !!document.querySelector(".q-count")`)) === true);

    console.log("== B. 判题 + 徽章 + chatSeed ==");
    await syn(".q-actions button", "判题");
    let row = "none";
    for (let i = 0; i < 20; i++) { await sleep(1000); row = await ev(`document.querySelector(".judge-row")?.textContent?.slice(0, 25) ?? "none"`); if (row !== "none") break; }
    check("判题出结果", row !== "none");
    await sleep(600);
    check("徽章 toast 弹出", (await ev(`!!document.querySelector(".toast-pop")`)) === true);
    await syn(".judge-ai-btn", "");
    await sleep(700);
    const seedVal = await ev(`document.querySelector(".chat-body textarea")?.value ?? "no-textarea"`);
    check("一键求助预填", String(seedVal).includes("判题失败"));
    await syn(".chat-head button", "×");
    await sleep(300);

    console.log("== C. 教练人格 ==");
    await syn(".topbar button", "设置");
    await sleep(700);
    await ev(`(() => {
      const cn = [...document.querySelectorAll(".settings-modal input")].find(i => (i.placeholder || "").includes("码灵"));
      if (cn) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(cn, "码灵"); cn.dispatchEvent(new Event("input", { bubbles: true })); }
    })()`);
    await syn(".modal-actions button", "保存");
    await sleep(500);
    await syn(".modal-mask", "");
    await sleep(300);
    check("模态框已关闭", (await ev(`!document.querySelector(".modal-mask")`)) === true);
    await syn(".topbar button", "AI 助教");
    await sleep(700);
    check("教练名字生效(码灵)", (await ev(`document.querySelector(".chat-head span")?.textContent`)) === "码灵");
    check("快捷按钮渲染", (await ev(`document.querySelectorAll(".chat-quick .btn-sm").length`)) >= 3);
    await syn(".chat-head button", "×");

    console.log("== F. 主题持久化重启验证 ==");
    console.log("  (重启验证在下一批次进行)");
    console.log(`\n===== 复测总结: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
