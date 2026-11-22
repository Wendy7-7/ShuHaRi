const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
http.get("http://127.0.0.1:" + (process.argv[2] || "9593") + "/json", (res) => {
  let d = "";
  res.on("data", (c) => (d += c));
  res.on("end", async () => {
    const page = JSON.parse(d).find((t) => t.url.includes("localhost"));
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pend = new Map();
    const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    };
    ws.onopen = async () => {
      await send("Runtime.enable");
      const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
      const click = async (sel, text) => {
        await ev("window.__cx=null");
        await ev("(() => { const all = [...document.querySelectorAll('" + sel + "')].filter(e => e.textContent.includes('" + (text || "") + "')); const el = all.find(e => e.tagName === 'BUTTON') || all[0]; if (!el) return; const r = el.getBoundingClientRect(); window.__cx = r.left + r.width / 2; window.__cy = r.top + r.height / 2; })()");
        const x = await ev("window.__cx");
        if (x == null) return "NO-ELEMENT";
        const y = await ev("window.__cy");
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        return "ok";
      };

      await sleep(2000);
      console.log("[1] 跳过教程:", await click(".tour-tip button", "跳过"));
      await sleep(400);
      console.log("[2] 打开帮助页:", await click(".nav-btn", "帮助"));
      await sleep(800);
      console.log("    页面渲染:", await ev("JSON.stringify({sections: document.querySelectorAll('.help-section').length, tables: document.querySelectorAll('.help-table').length, toolRows: document.querySelectorAll('.help-tool-row').length})"));
      console.log("    教程重开按钮:", await ev("[...document.querySelectorAll('.help-view button')].some(b => b.textContent.includes('重看新手教程')) ? 'PASS' : 'FAIL'"));
      console.log("[3] 打开设置:", await click(".btn-sm", "打开设置页配置"));
      await sleep(700);
      console.log("    预设选项:", await ev("JSON.stringify([...document.querySelectorAll('.settings-modal select option')].map(o => o.value))"));
      console.log("    切到 DeepSeek:", await ev("(() => { const s = document.querySelector('.settings-modal select'); const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; setter.call(s, 'deepseek'); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()"));
      await sleep(400);
      console.log("    官网按钮:", await ev("[...document.querySelectorAll('.settings-modal button')].some(b => b.textContent.includes('打开官网')) ? 'PASS' : 'FAIL'"));
      console.log("    步骤文案:", await ev("document.querySelector('.settings-modal')?.textContent.includes('第 1 步') ? 'PASS' : 'FAIL'"));
      process.exit(0);
    };
  });
});
