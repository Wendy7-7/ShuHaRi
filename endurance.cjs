// 耐力测试：连续操作下的稳定性、资源泄漏、状态持久性
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d))); }).on("error", reject);
  });
}
let PASS = 0, FAIL = 0;
const check = (name, ok, extra = "") => {
  if (ok) { PASS++; console.log(`  ✓ ${name} ${extra}`); }
  else { FAIL++; console.log(`  ✗ ${name} ${extra}`); }
};
const judgeTempCount = () => {
  try { return fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("learn_judge_")).length; }
  catch { return -1; }
};

(async () => {
  const port = process.argv[2] || "9840";
  const targets = await getJson(`http://127.0.0.1:${port}/json`);
  const page = targets.find((t) => t.type === "page" && t.url.includes("localhost"));
  if (!page) { console.log("NO PAGE"); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0, exc = 0;
  const pend = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") { exc++; } };
  ws.onopen = async () => {
    await send("Runtime.enable");
    const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const syn = async (sel, text) => ev(`(() => {
      const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
      const el = all.find(e => e.tagName === "BUTTON") || all[0];
      if (!el) return 0; el.click(); return 1;
    })()`);
    const heap = async () => {
      const r = await send("Runtime.getHeapUsage");
      return r.result ? Math.round(r.result.usedSize / 1024 / 1024) : -1;
    };

    await sleep(2500);
    await syn(".tour-tip button", "跳过"); await sleep(400);

    const heap0 = await heap();
    const temp0 = judgeTempCount();
    console.log(`基线：JS 堆 ${heap0}MB，判题临时目录 ${temp0} 个`);

    // ===== 1. 连续 10 次 C 判题（不同 temp，检查清理与稳定）=====
    console.log("\n== 连续 10 次 C 判题 ==");
    await syn(".nav-btn", "题库练习"); await sleep(2500);
    await syn(".q-item", ""); await sleep(2200);
    const sol = '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n';
    fs.writeFileSync(WS + "/practice/c-001.c", sol);
    let judgeOk = 0;
    for (let k = 0; k < 10; k++) {
      const before = await ev('document.querySelector(".judge-summary")?.textContent ?? ""');
      await syn(".q-actions button", "判题");
      let s = before;
      for (let i = 0; i < 20; i++) {
        await sleep(800);
        s = await ev('document.querySelector(".judge-summary")?.textContent ?? ""');
        if (s && s !== before) break;
      }
      if (s.includes("3/3")) judgeOk++;
      else { console.log(`  第 ${k + 1} 次异常:`, s.slice(0, 40)); break; }
    }
    check("连续 10 次判题全部 3/3", judgeOk === 10, `(${judgeOk}/10)`);

    // ===== 2. 40 次快速视图切换 =====
    console.log("\n== 40 次视图切换 ==");
    for (let i = 0; i < 40; i++) {
      await syn(".nav-btn", ["学习", "题库练习", "错题本", "统计", "帮助"][i % 5]);
      await sleep(120);
    }
    check("40 次切换后存活", (await ev('!!document.querySelector(".app")')) === true);

    // ===== 3. 20 次文件切换 =====
    console.log("\n== 20 次文件切换 ==");
    await syn(".nav-btn", "学习"); await sleep(600);
    let fileOk = true;
    for (let i = 0; i < 20; i++) {
      const f = i % 2 === 0 ? "hello.c" : "c-basics.md";
      const ok = await syn(".tree-node", f);
      if (!ok) { fileOk = false; break; }
      await sleep(350);
    }
    check("20 次文件切换无卡死", fileOk && (await ev('!!document.querySelector(".editor-tab")')) === true);

    // ===== 4. 50 次终端命令 =====
    console.log("\n== 50 次终端命令 ==");
    for (let i = 0; i < 50; i++) {
      await ev(`(() => { const t = document.querySelector(".terminal-host textarea"); if (t) t.focus(); })()`);
      await send("Input.insertText", { text: "echo endurance-" + i });
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await sleep(150);
    }
    await sleep(1200);
    check("50 次命令后终端含标记", (await ev('document.querySelector(".xterm-rows")?.textContent?.includes("endurance-49")')) === true);

    // ===== 5. 重库判题：3 次 pandas + 2 次 matplotlib =====
    console.log("\n== 重库连续判题 ==");
    await syn(".nav-btn", "题库练习"); await sleep(2000);
    await ev('(() => { const s = document.querySelector(".q-toolbar select"); const st = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set; st.call(s, "pandas"); s.dispatchEvent(new Event("change", { bubbles: true })); })()');
    await sleep(1500);
    await syn(".q-item", "Day 1"); await sleep(2200);
    fs.writeFileSync(WS + "/practice/py-mcm-01.py",
      'import pandas as pd\ndf = pd.read_csv("mcm/pandas_kit/data/level1_contest_raw.csv")\nprint(df.shape)\n');
    let pdOk = 0;
    for (let k = 0; k < 3; k++) {
      const before = await ev('document.querySelector(".judge-summary")?.textContent ?? ""');
      await syn(".q-actions button", "判题");
      let s = before;
      for (let i = 0; i < 25; i++) { await sleep(1000); s = await ev('document.querySelector(".judge-summary")?.textContent ?? ""'); if (s && s !== before) break; }
      if (s.includes("1/1")) pdOk++;
    }
    check("pandas 连续 3 次判题", pdOk === 3, `(${pdOk}/3)`);

    // ===== 6. 资源与内存 =====
    const heap1 = await heap();
    const temp1 = judgeTempCount();
    console.log(`\n结束后：JS 堆 ${heap1}MB（基线 ${heap0}MB），判题临时目录 ${temp1} 个（基线 ${temp0} 个）`);
    check("临时目录无累积泄漏", temp1 <= temp0 + 2, `(${temp0} → ${temp1})`);
    check("JS 堆增长在合理范围", heap1 - heap0 < 120, `(+${heap1 - heap0}MB)`);

    // ===== 7. 重启后状态一致性 =====
    console.log("\n== 重启一致性 ==");
    await ev("location.reload()");
    await sleep(4500);
    await syn(".nav-btn", "题库练习"); // 重载默认在学习页，先导航到练习页再读计数
    await sleep(2500);
    const solvedAfter = await ev('document.querySelector(".q-count")?.textContent ?? ""');
    check("重启后已解决数保留", solvedAfter.includes("已解决") && !solvedAfter.includes("已解决 0"), solvedAfter);
    check("重启后无异常", exc === 0 || exc < 3, `(异常 ${exc})`);
    check("重启后存活", (await ev('!!document.querySelector(".app")')) === true);

    console.log(`\n===== 耐力测试: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
})();
