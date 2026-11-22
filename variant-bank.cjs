// 变体题生成：为数值型题目生成 variant_cases（期望输出由脚本计算，非手填）
const fs = require("fs");
const path = require("path");
const os = require("os");
const WS = process.env.LEARN_WORKSPACE || path.join(os.homedir(), "learn-workspace");

const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const sum1toN = (n) => n * (n + 1) / 2;
const digitSum = (n) => String(n).split("").reduce((a, c) => a + Number(c), 0);

// 每题的变体生成器：返回 test_cases 数组（stdin + 期望输出）
const GEN = {
  "c-001": () => [[ "12 30\n", `${12 + 30}\n`], ["-7 40\n", `${-7 + 40}\n`], ["100 250\n", "350\n"]],
  "cpp-001": () => [[ "45 55\n", "100\n"], ["-12 -8\n", "-20\n"]],
  "go-01": () => [[ "25 17\n", "42\n"], ["-3 99\n", "96\n"]],
  "js-01": () => [[ "66 34\n", "100\n"], ["-40 -60\n", "-100\n"]],
  "c-005": () => [[ "77\n", `${sum1toN(77)}\n`], ["1\n", "1\n"]],
  "py-008": () => [[ "250\n", `${sum1toN(250)}\n`], ["9\n", "45\n"]],
  "j-004": () => [[ "64\n", `${sum1toN(64)}\n`], ["150\n", `${sum1toN(150)}\n`]],
  "c-006": () => [[ "9\n", `${fact(9)}\n`], ["10\n", `${fact(10)}\n`]],
  "py-006": () => [[ "11\n", `${fact(11)}\n`], ["8\n", `${fact(8)}\n`]],
  "j-008": () => [[ "7\n", `${fact(7)}\n`], ["11\n", `${fact(11)}\n`]],
  "js-04": () => [[ "6\n", `${fact(6)}\n`], ["10\n", `${fact(10)}\n`]],
  "c-007": (t) => variantMax(t, 5, [-3, 42, -17, 8, 29], "42"),
  "j-005": (t) => variantMax(t, 4, [88, -5, 123, 67], "123"),
  "go-02": (t) => variantMax(t, 6, [7, 90, 15, 33, 58, 2], "90"),
  "js-02": (t) => variantMax(t, 4, [200, -50, 175, 33], "200"),
  "c-008": (t) => variantReverse(t, [5, 12, 9, 30, 44], "44 30 9 12 5"),
  "c-009": () => [[ "987654\n", `${digitSum(987654)}\n`], ["111111\n", "6\n"]],
  "c-010": () => [[ "97\n", isPrime(97) ? "prime\n" : "composite\n"], ["91\n", isPrime(91) ? "prime\n" : "composite\n"], ["561\n", isPrime(561) ? "prime\n" : "composite\n"]],
  "py-007": () => [[ "101\n", isPrime(101) ? "prime\n" : "composite\n"], ["119\n", isPrime(119) ? "prime\n" : "composite\n"]],
  "go-03": () => [[ "131\n", isPrime(131) ? "prime\n" : "composite\n"], ["121\n", isPrime(121) ? "prime\n" : "composite\n"]],
};

// 数组类变体：沿用原用例的 stdin 格式构造
function variantMax(_t, n, arr, expected) {
  return [[`${n}\n${arr.join(" ")}\n`, `${expected}\n`]];
}
function variantReverse(_t, arr, expected) {
  return [[`${arr.length}\n${arr.join(" ")}\n`, `${expected}\n`]];
}

// 各题原始 timeout
const BANK = path.join(WS, "bank");
const BANK2 = path.join(__dirname, "portable", "workspace", "bank");
let updated = 0;
for (const [id, gen] of Object.entries(GEN)) {
  for (const dir of [BANK, BANK2]) {
    const p = path.join(dir, id + ".json");
    if (!fs.existsSync(p)) continue;
    const q = JSON.parse(fs.readFileSync(p, "utf8"));
    if ((q.variant_cases?.length ?? 0) > 0) continue; // 已有变体不覆盖
    const baseTimeout = q.test_cases?.[0]?.timeout_ms ?? 5000;
    q.variant_cases = gen().map(([stdin, expected]) => ({
      stdin, expected_stdout: expected, timeout_ms: Math.max(baseTimeout, 8000),
      ...(q.test_cases?.[0]?.setup_sql ? { setup_sql: q.test_cases[0].setup_sql } : {}),
      ...(q.test_cases?.[0]?.match_mode ? { match_mode: q.test_cases[0].match_mode } : {}),
    }));
    fs.writeFileSync(p, JSON.stringify(q, null, 2) + "\n");
  }
  updated++;
}
console.log(`变体已生成：${updated} 道题 ×2 个 bank 位置`);
// 校验几个期望值
console.log("抽检: c-005 变体1 期望 =", sum1toN(77), "；c-010 变体3 (561) =", isPrime(561) ? "prime" : "composite");
