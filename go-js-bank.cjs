// Go + JavaScript 题库：各 4 道（求和/数组最大/素数或反转/阶乘）
const fs = require("fs");
const path = require("path");

function q(id, lang, title, diff, tags, stmt, starter, hints, editorial, cases) {
  return { id, lang, title, difficulty: diff, tags, statement_md: stmt, starter_code: starter, hints, editorial_md: editorial, test_cases: cases };
}
const tc = (stdin, expected) => ({ stdin, expected_stdout: expected, timeout_ms: 15000 });

const questions = [
  // ===== Go =====
  q("go-01", "go", "两数之和（Go）", 1, ["入门"],
    "## 两数之和（Go）\n\n输入两个整数（空格分隔），输出它们的和。\n\n**输入**：一行，两个整数 a b\n\n**输出**：a+b",
    "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// 读入两个整数，输出它们的和\n}\n",
    ["用 var a, b int 声明，fmt.Scan(&a, &b) 读入", "fmt.Println(a + b) 输出"],
    "## 题解\n\n```go\nvar a, b int\nfmt.Scan(&a, &b)\nfmt.Println(a + b)\n```\n\nGo 的 fmt.Scan 按空白分隔读入，取地址符 & 不能少。",
    [tc("3 4\n", "7\n"), tc("-5 10\n", "5\n"), tc("0 0\n", "0\n")]),
  q("go-02", "go", "数组最大值（Go）", 2, ["数组"],
    "## 数组最大值（Go）\n\n先输入 n，再输入 n 个整数，输出最大值。",
    "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// 读入 n 和 n 个整数，输出最大值\n}\n",
    ["用 make([]int, n) 创建切片", "循环读入后用变量记录最大值"],
    "## 题解\n\n```go\nvar n int\nfmt.Scan(&n)\na := make([]int, n)\nfor i := 0; i < n; i++ {\n\tfmt.Scan(&a[i])\n}\nmx := a[0]\nfor _, v := range a {\n\tif v > mx {\n\t\tmx = v\n\t}\n}\nfmt.Println(mx)\n```",
    [tc("5\n3 7 2 9 4\n", "9\n"), tc("3\n-5 -2 -8\n", "-2\n")]),
  q("go-03", "go", "素数判断（Go）", 2, ["数学"],
    "## 素数判断（Go）\n\n输入 n（2 ≤ n ≤ 100000），是素数输出 `prime`，否则输出 `composite`。",
    "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// 判断 n 是否素数\n}\n",
    ["试除 2 到 i*i <= n", "用布尔变量标记，找到因子就 break"],
    "## 题解\n\n```go\nisPrime := true\nfor i := 2; i*i <= n; i++ {\n\tif n%i == 0 {\n\t\tisPrime = false\n\t\tbreak\n\t}\n}\nif isPrime {\n\tfmt.Println(\"prime\")\n} else {\n\tfmt.Println(\"composite\")\n}\n```",
    [tc("7\n", "prime\n"), tc("8\n", "composite\n"), tc("2\n", "prime\n")]),
  q("go-04", "go", "字符串反转（Go）", 2, ["字符串"],
    "## 字符串反转（Go）\n\n输入一个字符串（不含空格），输出它的反转。",
    "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// 读入字符串并反转输出\n}\n",
    ["Go 的字符串是字节序列，先转成 []rune 再反转（防止多字节字符被切碎）", "for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 { r[i], r[j] = r[j], r[i] }"],
    "## 题解\n\n```go\nvar s string\nfmt.Scan(&s)\nr := []rune(s)\nfor i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {\n\tr[i], r[j] = r[j], r[i]\n}\nfmt.Println(string(r))\n```\n\n为什么要 []rune？直接反转字节会把中文等多字节字符拆坏。",
    [tc("abc\n", "cba\n"), tc("hello\n", "olleh\n")]),

  // ===== JavaScript =====
  q("js-01", "javascript", "两数之和（JavaScript）", 1, ["入门"],
    "## 两数之和（JavaScript）\n\n输入两个整数（空格分隔），输出它们的和。\n\n**输入**：一行，两个整数 a b\n\n**输出**：a+b",
    "// 用 Node.js 读标准输入，输出两数之和\nconst input = require(\"fs\").readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\n\n// input 是数字数组，input[0] 和 input[1] 就是两个加数\n",
    ["fs.readFileSync(0) 读全部标准输入", "split(/\\s+/) 按空白切分，map(Number) 转成数字", "console.log(input[0] + input[1])"],
    "## 题解\n\n```js\nconst input = require(\"fs\").readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\nconsole.log(input[0] + input[1]);\n```",
    [tc("3 4\n", "7\n"), tc("-5 10\n", "5\n")]),
  q("js-02", "javascript", "数组最大值（JavaScript）", 1, ["数组"],
    "## 数组最大值（JavaScript）\n\n输入一行用空格分隔的整数，输出最大值。",
    "const nums = require(\"fs\").readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\n\n// 输出 nums 中的最大值\n",
    ["Math.max(...nums) 用展开运算符传整个数组", "或者 for 循环遍历找最大"],
    "## 题解\n\n```js\nconst nums = require(\"fs\").readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\nconsole.log(Math.max(...nums));\n```",
    [tc("3 7 2 9 4\n", "9\n"), tc("-5 -2 -8\n", "-2\n")]),
  q("js-03", "javascript", "字符串反转（JavaScript）", 1, ["字符串"],
    "## 字符串反转（JavaScript）\n\n输入一个字符串（不含空格），输出它的反转。",
    "const s = require(\"fs\").readFileSync(0, \"utf8\").trim();\n\n// 输出 s 的反转\n",
    ["s.split('') 转数组，reverse() 反转，join('') 拼回", "也可以 [...s].reverse().join('')"],
    "## 题解\n\n```js\nconst s = require(\"fs\").readFileSync(0, \"utf8\").trim();\nconsole.log([...s].reverse().join(''));\n```",
    [tc("abc\n", "cba\n"), tc("hello\n", "olleh\n")]),
  q("js-04", "javascript", "阶乘（JavaScript）", 1, ["循环"],
    "## 阶乘（JavaScript）\n\n输入 n（n ≤ 12），输出 n!。",
    "const n = Number(require(\"fs\").readFileSync(0, \"utf8\").trim());\n\n// 计算 n 的阶乘\n",
    ["let r = 1; for (let i = 2; i <= n; i++) r *= i;", "console.log(r)"],
    "## 题解\n\n```js\nconst n = Number(require(\"fs\").readFileSync(0, \"utf8\").trim());\nlet r = 1;\nfor (let i = 2; i <= n; i++) r *= i;\nconsole.log(r);\n```",
    [tc("5\n", "120\n"), tc("12\n", "479001600\n")]),
];

const targets = [
  require("path").join(process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace"), "bank"),
  __dirname + "/portable/workspace/bank",
];
for (const dir of targets) {
  for (const q of questions) fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
}
console.log("Go + JS 题库生成:", questions.length, "道");
