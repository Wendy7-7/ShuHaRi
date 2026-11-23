// 冒烟测试：对应测试书第五节 10 分钟清单（桌面版，需先启动带调试端口的应用）
let WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace"); // 连接后由 app_info 校准
const PROJ = __dirname;

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
  const port = process.argv[2] || "9760";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost"));
  if (!page) { console.log("NO PAGE"); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0, exc = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") { exc++; console.log("  !! EXC:", (m.params.exceptionDetails.exception?.description || "").slice(0, 120)); } };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    // 自动探测实例真实工作区（便携版=exe旁workspace，桌面版=~/learn-workspace）
    WS = (await ev(`window.__TAURI_INTERNALS__.invoke('app_info').then(x => x.defaultWorkspace)`).catch(() => WS)) || WS;
    const syn = async (sel, text) => ev(`(() => {
      const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
      const el = all.find(e => e.tagName === "BUTTON") || all[0];
      if (!el) return 0; el.click(); return 1;
    })()`);

    await sleep(2200);
    // 1 启动
    check("冷启动出界面", (await ev('!!document.querySelector(".app")')) === true);
    // 2 教程
    const tour = await ev('!!document.querySelector(".tour-tip")');
    check("教程弹出或已跳过", tour === true || (await ev('!!document.querySelector(".nav-btn")')) === true);
    if (tour) { await syn(".tour-tip button", "跳过"); await sleep(400); }
    // 3 工具链
    await syn(".nav-btn", "题库练习"); await sleep(2600);
    const chips = await ev('JSON.stringify([...document.querySelectorAll(".tool-chip")].map(c => c.textContent))');
    check("工具链 4 徽标齐全", chips.includes("gcc") && chips.includes("java") && chips.includes("python"));
    // 4 题库
    const count = await ev('document.querySelector(".q-count")?.textContent || ""');
    check("C 题库 10 题", count.includes("10 题"));
    // 5 starter 判题失败
    await syn(".q-item", ""); await sleep(2200);
    await syn(".q-actions button", "判题");
    let s1 = "";
    for (let i = 0; i < 20; i++) { await sleep(1000); s1 = await ev('document.querySelector(".judge-summary")?.textContent || ""'); if (s1) break; }
    check("判题失败渲染", s1.length > 0);
    // 6 写正确解（脚本直接写盘，避免编辑器依赖）
    const fs = require("fs");
    const q = JSON.parse(fs.readFileSync(WS + "/bank/c-001.json", "utf8"));
    fs.writeFileSync(WS + "/practice/c-001.c",
      '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n');
    await sleep(400);
    await syn(".q-actions button", "判题");
    let s2 = "";
    for (let i = 0; i < 20; i++) { await sleep(1000); s2 = await ev('document.querySelector(".judge-summary")?.textContent || ""'); if (s2.includes("3/3")) break; }
    check("正确解 3/3", s2.includes("3/3"));
    check("下一题按钮出现", (await ev('!!document.querySelector(".next-q-btn")')) === true);
    // 7 考试
    await syn(".nav-btn", "考试模式"); await sleep(800);
    await syn(".exam-setup button", "开始考试"); await sleep(1500);
    await syn(".q-toolbar button", "交卷"); await sleep(1800);
    await syn(".nav-btn", "统计"); await sleep(1000);
    // 幂等断言：重复跑冒烟时场次会累加，只要求至少有 1 场
    check("考试入库+统计", /[1-9]/.test(((await ev('[...document.querySelectorAll(".stat-card")].map(c=>c.textContent).find(t=>t.includes("完成考试"))')) || "")));
    // 8 主题
    await syn(".topbar button", "设置"); await sleep(600);
    await ev('document.querySelectorAll(".swatch")[3]?.click()');
    await sleep(300);
    check("主题色切换", (await ev('getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()')) === "#f472b6");
    await syn(".modal-mask", ""); await sleep(300);
    // 9 终端
    await syn(".nav-btn", "学习"); await sleep(800);
    check("终端就位", (await ev('!!document.querySelector(".terminal-host-inner")')) === true);
    // 10 存活 + 异常
    check("无 JS 异常", exc === 0);
    check("进程存活", (await ev("1")) === 1);

    console.log(`\n===== 冒烟: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
})();
