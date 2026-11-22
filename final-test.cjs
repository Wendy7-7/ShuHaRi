// 最终回归：真实鼠标教程 + 判题管线 + 压力
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = process.argv[2] || "9559";
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
    else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      console.log("!! JS EXCEPTION:", (d.exception?.description || d.text || "").slice(0, 400));
    }
  };

  ws.onopen = async () => {
    await send("Runtime.enable");
    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) { console.log("!! EVAL FAIL:", JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return null; }
      return r.result?.result?.value;
    };
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
      return "ok";
    };
    const nav = async (label) => { await realClick(".topbar", label); await sleep(500); };

    console.log("=== 1. TUTORIAL (real mouse, all 10 steps) ===");
    await send("Page.reload");
    await sleep(3500);
    for (let i = 1; i <= 10; i++) {
      const r = await realClick(".tour-tip", i === 10 ? "完成" : "下一步");
      if (r === "NO-ELEMENT") { console.log(`  step ${i}: TOUR GONE EARLY`); break; }
      if (sawClose) { console.log(`  !! CRASHED at step ${i}`); process.exit(2); }
      await sleep(450);
    }
    const tourGone = await evalJs(`!document.querySelector(".tour-tip")`);
    console.log("  tour completed & closed:", tourGone === true);

    console.log("=== 2. QUESTION + JUDGE PIPELINE ===");
    await nav("题库练习");
    await sleep(1200);
    console.log("  open question:", await realClick(".q-item"));
    await sleep(1500);
    console.log("  editor tab:", await evalJs(`document.querySelector(".editor-tab")?.textContent ?? "none"`));
    console.log("  click judge:", await realClick(".q-actions", "判题"));
    let judgeText = null;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      judgeText = await evalJs(`document.querySelector(".judge-summary")?.textContent ?? null`);
      if (judgeText) break;
      if (sawClose) { console.log("  !! CRASHED during judge"); process.exit(2); }
    }
    console.log("  judge result:", judgeText ?? "TIMEOUT waiting");
    const rows = await evalJs(`[...document.querySelectorAll(".judge-row")].map(r => r.textContent.slice(0, 40))`);
    console.log("  cases:", JSON.stringify(rows));

    console.log("=== 3. STRESS: 40x rapid view switching ===");
    const labels = ["学习", "题库练习", "错题本", "统计"];
    let died = false;
    for (let i = 0; i < 40; i++) {
      await nav(labels[i % 4]);
      if (i % 5 === 0) await sleep(100);
      if (sawClose) { console.log(`  !! CRASHED at switch ${i}`); died = true; break; }
    }
    if (!died) {
      const len = await evalJs(`document.getElementById("root")?.innerHTML.length ?? -1`);
      console.log("  survived 40 switches, rootHtmlLen=", len);
    }

    console.log("=== 4. TUTORIAL REOPEN x5 (帮助 button) ===");
    await nav("学习");
    for (let i = 0; i < 5; i++) {
      await realClick(".topbar", "帮助");
      await sleep(500);
      await realClick(".tour-tip", "跳过");
      await sleep(300);
      if (sawClose) { console.log(`  !! CRASHED at reopen ${i}`); died = true; break; }
    }
    console.log("  reopen x5 done, crashed:", died);

    const alive = !(await new Promise((res) => { send("Runtime.evaluate", { expression: "1" }).then(() => res(false)).catch(() => res(true)); }));
    console.log("=== FINAL: alive =", !alive, "| sawClose =", sawClose, "===");
    process.exit(alive ? 2 : 0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
