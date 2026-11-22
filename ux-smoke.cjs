// UX 特性冒烟：README 自动翻开 / 教程 CTA / AI 引导卡 / 新建文件
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}

(async () => {
  const port = process.argv[2] || "9590";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
    const click = async (sel, text) => {
      await ev("window.__cx=null");
      await eval(`(() => {})()`);
      await send("Runtime.evaluate", { expression: `(() => {
        const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
        const el = all.find(e => e.tagName === "BUTTON") || all[0];
        if (!el) return;
        const r = el.getBoundingClientRect();
        window.__cx = r.left + r.width / 2; window.__cy = r.top + r.height / 2;
      })()`, returnByValue: true });
      const x = await ev("window.__cx");
      if (x == null) return "NO-ELEMENT";
      const y = await ev("window.__cy");
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return "ok";
    };

    await sleep(2000);
    console.log("[1] README 自动翻开:", await ev(`document.querySelector(".reader-scroll")?.textContent?.includes("欢迎使用 LearnPlatform") ? "PASS" : "FAIL"`));

    for (let i = 0; i < 9; i++) { await click(".tour-tip button", "下一步"); await sleep(250); }
    await sleep(300);
    console.log("[2] 最后一步 CTA 出现:", await ev(`[...document.querySelectorAll(".tour-tip button")].some(b => b.textContent.includes("开始第一道题")) ? "PASS" : "FAIL"`));
    console.log("[3] 点击 CTA:", await click(".tour-tip button", "开始第一道题"));
    await sleep(3000);
    console.log("    落点编辑器:", await ev(`document.querySelector(".editor-tab")?.textContent?.slice(0, 16)`));
    console.log("    落点练习页:", await ev(`document.querySelector(".q-count")?.textContent`));

    console.log("[4] AI 引导卡:", await click(".topbar button", "AI 助教"));
    await sleep(700);
    console.log("    引导卡出现:", await ev(`!!document.querySelector(".ai-setup-card") ? "PASS" : "FAIL"`));
    await click(".chat-head button", "×");

    await click(".nav-btn", "学习"); await sleep(800); await click(".nav-btn", "学习"); await sleep(800); console.log("[5] 新建文件: 点＋ =", await click(".tree-refresh", "＋"));
    await sleep(500);
    await ev(`(() => { const i = document.querySelector(".newfile-modal input"); if (i) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; s.call(i, "test-note.md"); i.dispatchEvent(new Event("input", { bubbles: true })); } })()`);
    await sleep(300);
    console.log("    创建:", await click(".newfile-modal button", "创建"));
    await sleep(900);
    console.log("    出现在树中:", await ev(`[...document.querySelectorAll(".tree-node")].some(n => n.textContent.includes("test-note.md")) ? "PASS" : "FAIL"`));
    process.exit(0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
