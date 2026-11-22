// CDP 全面测试：教程逐步点击 + 全视图切换 + 崩溃检测 + 压力测试
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
  const port = process.argv[2] || "9555";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page =
    targets.find((t) => t.type === "page" && t.url.includes("localhost")) ||
    targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  let crashed = null;
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      console.log("!! JS EXCEPTION:", (d.exception?.description || d.text || "").slice(0, 800));
    }
  };
  ws.onclose = () => {
    if (crashed === null) crashed = "ws closed unexpectedly";
  };

  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      console.log("!! EVAL EXCEPTION:", JSON.stringify(r.result.exceptionDetails).slice(0, 600));
      return null;
    }
    return r.result?.result?.value;
  };
  const click = async (sel) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return "MISSING:" + ${JSON.stringify(sel)}; el.click(); return "ok"; })()`);
  const clickByText = async (sel, text) => evalJs(`(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})]; const el = els.find(e => e.textContent.includes(${JSON.stringify(text)})); if (!el) return "MISSING:" + ${JSON.stringify(text)}; el.click(); return "ok"; })()`);
  const alive = async () => {
    try { await send("Runtime.evaluate", { expression: "1" }); return true; } catch { return false; }
  };

  ws.onopen = async () => {
    await send("Runtime.enable");
    let step = 1;
    // ---------- 教程逐页点击 ----------
    console.log("=== TUTORIAL WALKTHROUGH ===");
    for (; step <= 10; step++) {
      await sleep(700);
      const hasTour = await evalJs(`!!document.querySelector(".tour-tip")`);
      if (hasTour === null) { console.log(`step ${step}: PAGE DEAD`); break; }
      if (!hasTour) { console.log(`step ${step}: tour already closed`); break; }
      const r = await clickByText(".tour-tip button", step === 10 ? "完成" : "下一步");
      console.log(`step ${step} -> next: ${r}`);
      if (r === null) { console.log(`CRASHED after clicking next on step ${step}`); break; }
      await sleep(400);
      if (!(await alive())) { console.log(`PROCESS/WS DIED after step ${step}`); break; }
    }
    console.log("=== tutorial phase done ===");

    if (await alive()) {
      // ---------- 视图切换冒烟 ----------
      console.log("=== VIEW SWITCH SMOKE ===");
      for (const label of ["题库练习", "错题本", "统计", "学习"]) {
        const r = await clickByText(".topbar button", label);
        await sleep(600);
        const len = await evalJs(`document.getElementById("root")?.innerHTML.length ?? -1`);
        console.log(`view "${label}": click=${r}, rootHtmlLen=${len}, alive=${await alive()}`);
        if (!(await alive())) break;
      }
      // ---------- 打开一道题 ----------
      console.log("=== OPEN QUESTION ===");
      await clickByText(".topbar button", "题库练习");
      await sleep(1500);
      const q = await click(".q-item");
      await sleep(800);
      const edFile = await evalJs(`document.querySelector(".editor-tab")?.textContent ?? "no-tab"`);
      console.log(`question click=${q}, editorTab=${edFile}`);
      // ---------- 终端压力：向终端快速写入 ----------
      console.log("=== TERMINAL STRESS ===");
      await evalJs(`(() => { const t = document.querySelector(".terminal-host textarea"); if (t) { t.focus(); return "focused"; } return "no-textarea"; })()`);
      // 用 xterm 不可达，改为模拟大量视图切换压力
      console.log("=== RAPID SWITCH STRESS (20x) ===");
      for (let i = 0; i < 20; i++) {
        await clickByText(".topbar button", i % 2 === 0 ? "学习" : "题库练习");
        await sleep(80);
        if (!(await alive())) { console.log(`DIED at switch ${i}`); break; }
      }
      const finalLen = await evalJs(`document.getElementById("root")?.innerHTML.length ?? -1`);
      console.log(`after stress: rootHtmlLen=${finalLen}, alive=${await alive()}`);
    }
    console.log("=== ALL TESTS DONE, alive=" + (await alive()) + " ===");
    process.exit(0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
