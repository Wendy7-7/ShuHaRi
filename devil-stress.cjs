// 魔鬼级压力测试：恶意输入、资源轰炸、并发冲突、数据库冲击
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const WS = process.env.LEARN_WORKSPACE || path.join(os.homedir(), "learn-workspace");

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

(async () => {
  const port = process.argv[2] || "9880";
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
    const invoke = async (cmd, args) => ev(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args)}).then(x => JSON.stringify(x)).catch(e => "ERR:" + String(e))`);
    const heap = async () => { const r = await send("Runtime.getHeapUsage"); return r.result ? Math.round(r.result.usedSize / 1024 / 1024) : -1; };
    const syn = async (sel, text) => ev(`(() => {
      const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => e.textContent.includes(${JSON.stringify(text || "")}));
      const el = all.find(e => e.tagName === "BUTTON") || all[0];
      if (!el) return 0; el.click(); return 1;
    })()`);
    const judge = async (codePath, lang, cases) => {
      const r = await invoke("judge", { codePath, lang, cases });
      try { return JSON.parse(r); } catch { return [{ error: String(r) }]; }
    };
    const TC = (stdin, exp) => ({ stdin, expected_stdout: exp, timeout_ms: 6000 });
    const tempCount = () => { try { return fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("learn_judge_")).length; } catch { return -1; } };

    await sleep(2500);
    await syn(".tour-tip button", "跳过"); await sleep(400);
    const heap0 = await heap();
    const temp0 = tempCount();
    console.log(`基线：堆 ${heap0}MB，临时目录 ${temp0}`);

    const workFile = path.join(WS, "practice", "devil.c");
    fs.mkdirSync(path.join(WS, "practice"), { recursive: true });

    // ===== A. 恶意代码（直调 judge）=====
    console.log("\n== A. 恶意代码判题 ==");
    const casesA = [TC("1\n", "x\n")];

    // A1 死循环
    fs.writeFileSync(workFile, '#include <stdio.h>\nint main(){while(1){}return 0;}\n');
    let r = await judge(workFile, "c", casesA);
    check("A1 死循环被超时拦截", Array.isArray(r) && r[0] && (r[0].status === "超时" || r[0].pass === false), JSON.stringify(r[0]).slice(0, 50));

    // A2 无限递归（栈溢出）
    fs.writeFileSync(workFile, '#include <stdio.h>\nvoid f(){f();}\nint main(){f();return 0;}\n');
    r = await judge(workFile, "c", casesA);
    check("A2 栈溢出程序不炸判题器", Array.isArray(r) && r[0] && r[0].pass === false, JSON.stringify(r[0]).slice(0, 60));

    // A3 大输出（1MB）
    fs.writeFileSync(workFile, '#include <stdio.h>\nint main(){for(int i=0;i<20000;i++)printf("0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefgh\\n");return 0;}\n');
    r = await judge(workFile, "c", casesA);
    check("A3 1MB 输出不炸", Array.isArray(r) && r[0] && r[0].pass === false, `输出长度 ${r[0]?.actual?.length ?? "?"}`);

    // A4 ANSI 转义注入
    fs.writeFileSync(workFile, '#include <stdio.h>\nint main(){printf("\\x1b[31mred\\x1b[0m\\n");return 0;}\n');
    r = await judge(workFile, "c", casesA);
    check("A4 ANSI 转义不导致崩溃", Array.isArray(r) && r[0] !== undefined);

    // A5 二进制/NUL 输出
    fs.writeFileSync(workFile, '#include <stdio.h>\nint main(){for(int i=0;i<256;i++)putchar(i);return 0;}\n');
    r = await judge(workFile, "c", casesA);
    check("A5 二进制/NUL 输出不炸", Array.isArray(r) && r[0] !== undefined);

    // A6 编译错误
    fs.writeFileSync(workFile, 'int main(){this is not C}\n');
    r = await judge(workFile, "c", casesA);
    check("A6 编译错误被捕获", Array.isArray(r) && r[0] && (r[0].status === "编译失败" || String(r[0].error).includes("编译失败")), JSON.stringify(r[0]).slice(0, 40));

    // A7 空文件
    fs.writeFileSync(workFile, '');
    r = await judge(workFile, "c", casesA);
    check("A7 空文件不炸", Array.isArray(r) && r[0] && (r[0].pass === false || String(r[0].error).includes("编译失败")));

    // A8 非 UTF8（GBK）输出
    fs.writeFileSync(workFile, '#include <stdio.h>\nint main(){printf("\\xc4\\xe3\\xba\\xc3\\n");return 0;}\n');
    r = await judge(workFile, "c", casesA);
    check("A8 GBK 输出不乱码崩溃", Array.isArray(r) && r[0] !== undefined);

    // ===== B. 轰炸 =====
    console.log("\n== B. 判题轰炸 ==");
    const solB = '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}\n';
    let bombOk = 0;
    for (let k = 0; k < 30; k++) {
      fs.writeFileSync(workFile, solB);
      const rr = await judge(workFile, "c", [TC("1 2\n", "3\n")]);
      if (rr[0] && rr[0].pass) bombOk++;
      else { console.log(`  第 ${k + 1} 次失败:`, JSON.stringify(rr[0]).slice(0, 60)); break; }
    }
    check("B1 连续 30 次 C 判题全过", bombOk === 30, `(${bombOk}/30)`);

    // SQL 恶意输入
    const sqlFile = path.join(WS, "practice", "devil.sql");
    const setup = "CREATE TABLE t(a INTEGER);INSERT INTO t VALUES(1),(2);";
    fs.writeFileSync(sqlFile, "DROP TABLE t;");
    let rs = await judge(sqlFile, "sql", [{ stdin: "", expected_stdout: "", setup_sql: setup, timeout_ms: 5000 }]);
    check("B2 SQL DROP 被只读限制拦截", rs[0] && rs[0].pass === false && rs[0].actual.includes("SELECT"), JSON.stringify(rs[0]).slice(0, 60));
    fs.writeFileSync(sqlFile, "SELECT * FROM t;");
    rs = await judge(sqlFile, "sql", [{ stdin: "", expected_stdout: "a\n1\n2", setup_sql: setup, timeout_ms: 5000 }]);
    check("B3 SQL 正常查询通过", rs[0] && rs[0].pass === true);
    fs.writeFileSync(sqlFile, "SELECT * FROM nonexistent;");
    rs = await judge(sqlFile, "sql", [{ stdin: "", expected_stdout: "", setup_sql: setup, timeout_ms: 5000 }]);
    check("B4 SQL 错误表名报运行错误", rs[0] && rs[0].status === "运行错误");

    // Go/JS 轰炸
    const goFile = path.join(WS, "practice", "devil.go");
    fs.writeFileSync(goFile, 'package main\nimport "fmt"\nfunc main(){fmt.Println(42)}');
    const rg = await judge(goFile, "go", [TC("", "42\n")]);
    check("B5 Go 判题通过", rg[0] && rg[0].pass === true, JSON.stringify(rg[0]).slice(0, 40));
    const jsFile = path.join(WS, "practice", "devil.js");
    fs.writeFileSync(jsFile, 'console.log(6*7)');
    const rj = await judge(jsFile, "javascript", [TC("", "42\n")]);
    check("B6 JS 判题通过", rj[0] && rj[0].pass === true);

    // ===== C. 数据库冲击 =====
    console.log("\n== C. 数据库冲击 ==");
    const bigBank = path.join(os.tmpdir(), "devil_bank");
    fs.mkdirSync(bigBank, { recursive: true });
    const sampleQ = JSON.parse(fs.readFileSync(path.join(WS, "bank", "c-001.json"), "utf8"));
    for (let i = 0; i < 200; i++) {
      const q = { ...sampleQ, id: "devil-" + i, title: "压力测试题 " + i };
      fs.writeFileSync(path.join(bigBank, "devil-" + i + ".json"), JSON.stringify(q));
    }
    const importStart = Date.now();
    const n = await invoke("import_bank", { dir: bigBank });
    check("C1 200 题批量导入", String(n).includes("200") || n === "200", `${n}（${Date.now() - importStart}ms）`);
    const qs = await invoke("list_questions", {});
    check("C2 导入后可查询", (() => { try { return JSON.parse(qs).length >= 200; } catch { return false; } })(), (() => { try { return `题库 ${JSON.parse(qs).length} 题`; } catch { return "解析失败"; } })());

    // ===== D. UI 压力 =====
    console.log("\n== D. UI 压力 ==");
    for (let i = 0; i < 100; i++) {
      await syn(".nav-btn", ["学习", "题库练习", "错题本", "统计", "帮助"][i % 5]);
      await sleep(60);
    }
    check("D1 100 次视图切换存活", (await ev('!!document.querySelector(".app")')) === true);
    for (let i = 0; i < 20; i++) {
      await syn(".topbar button", "AI 助教"); await sleep(150);
      await ev('(() => { const b = document.querySelector(".chat-head button"); if (b) b.click(); })()');
      await sleep(150);
    }
    check("D2 20 次 AI 面板开关无异常", (await ev('!!document.querySelector(".app")')) === true);

    // 终端 500 行输出
    await syn(".nav-btn", "学习"); await sleep(600);
    await ev(`(() => { const t = document.querySelector(".terminal-host textarea"); if (t) t.focus(); })()`);
    await send("Input.insertText", { text: "1..500 | ForEach-Object { Write-Output $_ }" });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await sleep(4000);
    check("D3 终端 500 行输出含 500", (await ev('document.querySelector(".xterm-rows")?.textContent?.includes("500")')) === true);

    // ===== E. 恢复与资源 =====
    const heap1 = await heap();
    const temp1 = tempCount();
    console.log(`\n结束：堆 ${heap1}MB（基线 ${heap0}MB），临时目录 ${temp1}（基线 ${temp0}）`);
    check("E1 临时目录无泄漏", temp1 <= temp0 + 3, `(${temp0} → ${temp1})`);
    check("E2 堆增长合理", heap1 - heap0 < 200, `(+${heap1 - heap0}MB)`);
    check("E3 全程存活且异常数低", exc < 5, `(异常 ${exc})`);

    console.log(`\n===== 魔鬼压力测试: PASS ${PASS} / FAIL ${FAIL} =====`);
    process.exit(FAIL > 0 ? 2 : 0);
  };
})();
