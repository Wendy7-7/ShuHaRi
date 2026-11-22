// 真实鼠标输入管线测试：教程全流程 + 快速连点压力
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = process.argv[2] || "9556";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  let sawClose = false;
  ws.onclose = () => { sawClose = true; };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === "Runtime.consoleAPICalled") {
      const t = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (t.includes("[TOUR]")) console.log("  [page]", t.slice(0, 200));
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      console.log("!! JS EXCEPTION:", (d.exception?.description || d.text || "").slice(0, 600));
    }
  };

  ws.onopen = async () => {
    await send("Runtime.enable");
    // 注入全局错误捕获
    await send("Runtime.evaluate", { expression: `
      window.addEventListener('error', e => console.error('[TOUR][window.error]', e.message, e.filename, e.lineno));
      window.addEventListener('unhandledrejection', e => console.error('[TOUR][unhandled]', String(e.reason).slice(0,300)));
      console.log('[TOUR] hooks installed');
    `});

    // 真实鼠标点击元素中心
    const realClick = async (sel, text) => {
      const got = await send("Runtime.evaluate", { expression: `(() => {
        let el = ${sel ? `document.querySelector(${JSON.stringify(sel)})` : "null"};
        if (el && ${JSON.stringify(text || "")}) { el = [...el.querySelectorAll("button")].find(b => b.textContent.includes(${JSON.stringify(text)})); }
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })()`, returnByValue: true });
      const v = got.result?.result?.value;
      if (!v) return "NO-ELEMENT";
      const { x, y } = JSON.parse(v);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return `clicked@(${Math.round(x)},${Math.round(y)})`;
    };

    // 先重开教程（若已关闭）：刷新页面即可触发 auto-open
    console.log("=== reload to trigger tutorial ===");
    await send("Page.reload");
    await sleep(3000);

    console.log("=== TUTORIAL with REAL MOUSE ===");
    for (let i = 1; i <= 10; i++) {
      const r = await realClick(".tour-tip", i === 10 ? "完成" : "下一步");
      console.log(`step ${i}: ${r}`);
      if (r === "NO-ELEMENT") { console.log("  (tour tip gone)"); break; }
      await sleep(500);
      if (sawClose) { console.log("!! WS CLOSED — process likely crashed at step", i); process.exit(2); }
    }

    console.log("=== FAST CLICK STRESS on tour (10 rapid) ===");
    // 重开教程
    await send("Page.reload");
    await sleep(3000);
    for (let i = 1; i <= 10; i++) {
      await realClick(".tour-tip", "下一步");
      await sleep(60);
      if (sawClose) { console.log("!! CRASHED during rapid clicking at", i); process.exit(2); }
    }
    const st = await send("Runtime.evaluate", { expression: `JSON.stringify({tour: !!document.querySelector(".tour-tip"), step: document.querySelector(".tour-stepnum")?.textContent})`, returnByValue: true });
    console.log("after rapid:", st.result?.result?.value);
    console.log("=== DONE, ws still open:", !sawClose, "===");
    process.exit(0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
