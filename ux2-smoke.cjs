const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}

(async () => {
  const port = process.argv[2] || "9601";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost")) || targets.find((t) => t.type === "page");
  if (!page) { console.log("NO PAGE TARGET"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result?.result?.value;
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

    await sleep(2000);
    console.log("[1] 跳过教程:", await realClick(".tour-tip button", "跳过"));
    await sleep(400);
    console.log("[2] 打开设置:", await realClick(".topbar button", "设置"));
    await sleep(700);
    console.log("    个性化区渲染:", await ev(`JSON.stringify({swatches: document.querySelectorAll(".swatch").length, picker: !!document.querySelector(".swatch-picker"), styleSelect: [...document.querySelectorAll(".settings-modal select")].some(s => s.textContent.includes("严格教练"))})`));

    // 点第 2 个色块（绿色）——用索引定位
    console.log("[3] 换主题色:", await ev(`(() => { const el = document.querySelectorAll(".swatch")[1]; if (!el) return 0; el.click(); return 1; })()`) === 1 ? "ok" : "fail");
    await sleep(400);
    console.log("    CSS 变量 --accent:", await ev(`getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "(empty)"`));
    console.log("    持久化(重启后仍生效):", await ev(`!!document.documentElement.style.getPropertyValue("--accent") ? "PASS" : "FAIL"`));

    console.log("[4] 昵称 + 教练风格 + 保存:");
    await ev(`(() => {
      const inputs = [...document.querySelectorAll(".settings-modal input")];
      const nick = inputs.find(i => (i.placeholder || "").includes("阿迪"));
      if (nick) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        s.call(nick, "阿迪");
        nick.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const sel = [...document.querySelectorAll(".settings-modal select")].find(x => x.textContent.includes("严格教练"));
      if (sel) {
        const st = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        st.call(sel, "strict");
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`);
    console.log("    保存:", await realClick(".modal-actions button", "保存"));
    await sleep(600);
    console.log("[5] 关闭设置:", await realClick(".modal-mask", ""));
    await sleep(400);
    console.log("    nav 统计:", await realClick(".nav-btn", "统计"));
    await sleep(900);
    console.log("    徽章墙+统计卡:", await ev(`JSON.stringify({
      wall: !!document.querySelector(".badge-wall"),
      cards: document.querySelectorAll(".badge-card").length,
      statCards: document.querySelectorAll(".stat-card").length,
      streak: [...document.querySelectorAll(".stat-card")].map(c => c.textContent).find(t => t.includes("连续"))
    })`));
    console.log("[6] AI 面板标题(昵称未设置名时仍默认):", await realClick(".topbar button", "AI 助教"));
    await sleep(700);
    console.log("    ", await ev(`document.querySelector(".chat-head span")?.textContent`));
    process.exit(0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
