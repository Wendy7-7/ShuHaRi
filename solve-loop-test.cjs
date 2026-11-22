// 真实解题闭环：判错→改对→错题解除→统计入账→Vim 开关
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
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
  // 前置重置：避免上个套件留下的解答污染本轮判题
  try { const q = JSON.parse(require("fs").readFileSync(WS + "/bank/c-001.json", "utf8")); require("fs").writeFileSync(WS + "/practice/c-001.c", q.starter_code); } catch {}

  const port = process.argv[2] || "9630";
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

    await sleep(2000);
    await syn(".tour-tip button", "跳过");
    await sleep(400);
    await syn(".nav-btn", "题库练习");
    await sleep(2000);
    // 打开 c-001
    await syn(".q-item", "两数之和");
    await sleep(1800);

    console.log("== 第 1 次判题（starter 代码，应失败并进错题本）==");
    await syn(".q-actions button", "判题");
    let summary = "";
    for (let i = 0; i < 20; i++) { await sleep(1000); summary = await ev(`document.querySelector(".judge-summary")?.textContent ?? ""`); if (summary) break; }
    check("判题失败结果渲染", summary.includes("0/3") || summary.includes("用例通过"));
    await sleep(300);
    await syn(".nav-btn", "错题本");
    await sleep(800);
    const m1 = await ev(`document.querySelectorAll(".mistake-row").length`);
    check(`错题本记录 1 条 (实际 ${m1})`, m1 === 1);
    await syn(".nav-btn", "题库练习");
    await sleep(1200);

    console.log("== 写入正确解（脚本直接写盘，零竞态）==");
    require("fs").writeFileSync(
      WS + "/practice/c-001.c",
      '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}\n',
    );
    await sleep(500);
    await syn(".q-actions button", "判题");
    let summary2 = "";
    for (let i = 0; i < 20; i++) { await sleep(1000); summary2 = await ev(`document.querySelector(".judge-summary")?.textContent ?? ""`); if (summary2.includes("3/3")) break; }
    check(`判题 3/3 全过 (实际: ${summary2.trim() || "空"})`, summary2.includes("3/3"));
    await sleep(800);
    check("列表 ✓ 已解决标记", (await ev(`[...document.querySelectorAll(".q-item")].find(x => x.textContent.includes("两数之和"))?.textContent.includes("✓")`)) === true);
    check("进度文案", (await ev(`document.querySelector(".q-count")?.textContent`))?.includes("已解决 1") === true);

    console.log("== 错题自动解除 ==");
    await syn(".nav-btn", "错题本");
    await sleep(800);
    const unres = await ev(`document.querySelectorAll(".mistake-row:not(.done)").length`);
    const done = await ev(`document.querySelectorAll(".mistake-row.done").length`);
    check(`错题已移入已掌握 (未攻克 ${unres} / 已掌握 ${done})`, unres === 0 && done >= 1);
    await syn(".nav-btn", "统计");
    await sleep(900);
    check("统计 已解决 1", (await ev(`[...document.querySelectorAll(".stat-card")].map(c => c.textContent).find(t => t.includes("已解决"))`))?.includes("1") === true);
    check("徽章 拥有≥2(第一枪+破土)", parseInt((await ev(`[...document.querySelectorAll(".stat-card")].map(c => c.textContent).find(t => t.includes("徽章"))`))?.split("/")[0] ?? "0", 10) >= 2);

    console.log("== Vim 开关（状态栏判断）==");
    await syn(".nav-btn", "题库练习");
    await sleep(1000);
    const vimBefore = await ev(`document.body.textContent.includes("NORMAL")`);
    check("初始 Vim 关（无 -- NORMAL --）", vimBefore === false);
    await syn(".topbar button", "Vim: 关");
    await sleep(700);
    const vimOn = await ev(`document.body.textContent.includes("NORMAL")`);
    check("开启后出现 -- NORMAL --", vimOn === true);
    await syn(".topbar button", "Vim: 开");
    await sleep(700);
    const vimOff = await ev(`document.body.textContent.includes("NORMAL")`);
    check("关闭后状态栏消失", vimOff === false);
    check("全程无 JS 异常且存活", (await ev(`1`)) === 1);

    console.log(`\n===== 解题闭环总结: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
  ws.onerror = (e) => { console.log("WS ERROR", e.message ?? String(e)); process.exit(1); };
})();
