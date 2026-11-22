// 一键运行端到端冒烟：打开 hello.c → 点 ▶ 运行 → 检查终端输出
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = process.argv[2] || "9560";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method === "Runtime.exceptionThrown") {
      console.log("!! JS EXCEPTION:", (msg.params.exceptionDetails.exception?.description || "").slice(0, 300));
    }
  };

  ws.onopen = async () => {
    await send("Runtime.enable");
    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      return r.result?.result?.value;
    };
    const realClick = async (sel, text) => {
      await evalJs(`(() => {
        const all = [...document.querySelectorAll(${JSON.stringify(sel)})];
        let el = all.find(e => e.textContent.includes(${JSON.stringify(text || "")})) || all[0] || null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        window.__cx = r.left + r.width / 2; window.__cy = r.top + r.height / 2;
      })()`);
      const x = await evalJs("window.__cx"), y = await evalJs("window.__cy");
      if (x == null) return "NO-ELEMENT";
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return `ok@(${Math.round(x)},${Math.round(y)})`;
    };

    console.log("=== 关闭教程（若弹出） ===");
    await sleep(2500);
    await realClick(".tour-tip", "跳过");
    await sleep(400);

    console.log("=== 打开 hello.c ===");
    await realClick(".tree-node", "hello.c");
    await sleep(2000);
    console.log("editor tab:", await evalJs(`document.querySelector(".editor-tab")?.textContent?.slice(0, 30)`));

    console.log("=== 点击 ▶ 运行 ===");
    console.log("run click:", await realClick(".run-btn", ""));
    await sleep(6000);
    const termText = await evalJs(`document.querySelector(".xterm-rows")?.textContent?.slice(-400) ?? "no-terminal"`);
    console.log("=== 终端输出（尾部） ===");
    console.log(termText);
    const ok = typeof termText === "string" && termText.includes("Hello, LearnPlatform!");
    console.log("=== RESULT:", ok ? "PASS ✓" : "FAIL ✗", "===");
    process.exit(ok ? 0 : 2);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
