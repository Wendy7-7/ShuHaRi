// 用 WebView2 渲染 SVG 图标并截图：1024x1024 PNG → 供 tauri icon 生成全套
const fs = require("fs");
const http = require("http");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SVG = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b2026"/>
      <stop offset="1" stop-color="#12161a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6fd3ff"/>
      <stop offset="1" stop-color="#3aa8ea"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
  <rect x="26" y="26" width="972" height="972" rx="204" fill="none" stroke="#2b323a" stroke-width="10"/>
  <text x="500" y="600" font-family="Consolas, 'Courier New', monospace" font-size="360" font-weight="bold" fill="url(#accent)" text-anchor="middle">&lt;/&gt;</text>
  <circle cx="770" cy="782" r="128" fill="#1e7a46" stroke="#12161a" stroke-width="20"/>
  <path d="M700 788 l48 48 l104 -108" stroke="#8df2b8" stroke-width="38" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

(async () => {
  const port = process.argv[2] || "9770";
  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost"));
  if (!page) { console.log("NO PAGE"); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };

  ws.onopen = async () => {
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 1024, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    await send("Runtime.evaluate", {
      expression: `(() => {
        document.documentElement.style.margin = "0";
        document.body.style.margin = "0";
        document.body.style.background = "transparent";
        document.body.innerHTML = ${JSON.stringify(SVG.replace(/\n\s*/g, " "))};
      })()`,
    });
    await sleep(600);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1024, height: 1024, scale: 1 } });
    const b64 = shot.result?.data;
    if (!b64) { console.log("截图失败", JSON.stringify(shot).slice(0, 200)); process.exit(1); }
    fs.writeFileSync(process.argv[3] || "icon-src.png", Buffer.from(b64, "base64"));
    console.log("图标源图已生成 icon-src.png", Math.round(Buffer.from(b64, "base64").length / 1024), "KB");
    process.exit(0);
  };
})();
