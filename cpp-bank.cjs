// 补 C++ 题库：4 道（消除"有 C++ 选项但 0 题"的缺口）
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const fs = require("fs");
const path = require("path");

function cpp(id, title, diff, tags, stmt, starter, hints, editorial, cases) {
  return { id, lang: "cpp", title, difficulty: diff, tags, statement_md: stmt, starter_code: starter, hints, editorial_md: editorial, test_cases: cases };
}

const questions = [
  cpp("cpp-001", "两数之和（C++）", 1, ["入门"],
    "## 两数之和（C++）\n\n输入两个整数，输出它们的和。\n\n**输入**：一行，两个整数 a b\n\n**输出**：a+b",
    "#include <iostream>\n\nint main() {\n    // 读入两个整数，输出它们的和\n    return 0;\n}\n",
    ["用 cin >> a >> b 读入两个数", "用 cout << a + b << endl 输出"],
    "## 题解\n\n```cpp\nint a, b;\ncin >> a >> b;\ncout << a + b << endl;\n```\n\nC++ 用 iostream 而不是 stdio.h，endl 会换行并刷新缓冲。",
    [
      { stdin: "3 4\n", expected_stdout: "7\n" },
      { stdin: "-5 10\n", expected_stdout: "5\n" },
      { stdin: "0 0\n", expected_stdout: "0\n" },
    ]),
  cpp("cpp-002", "数组最大值（C++）", 2, ["数组"],
    "## 数组最大值\n\n先输入 n，再输入 n 个整数，输出最大值。\n\n**输入**：第一行 n（1 ≤ n ≤ 1000），第二行 n 个整数",
    "#include <iostream>\n#include <vector>\n\nint main() {\n    // 读入 n 个数，输出最大值\n    return 0;\n}\n",
    ["vector<int> a(n); 创建长度为 n 的动态数组", "读入后可以用 max 变量遍历，也可以直接 *max_element(a.begin(), a.end())"],
    "## 题解\n\n```cpp\nint n; cin >> n;\nvector<int> a(n);\nfor (auto &x : a) cin >> x;\nint mx = a[0];\nfor (auto x : a) if (x > mx) mx = x;\ncout << mx << endl;\n```\n\nC++ 的 vector 比 C 的定长数组灵活，`for (auto &x : a)` 是范围 for 循环。",
    [
      { stdin: "5\n3 7 2 9 4\n", expected_stdout: "9\n" },
      { stdin: "3\n-5 -2 -8\n", expected_stdout: "-2\n" },
    ]),
  cpp("cpp-003", "字符串反转（C++）", 2, ["字符串"],
    "## 字符串反转\n\n输入一个字符串（不含空格），输出它的反转。",
    "#include <iostream>\n#include <string>\n\nint main() {\n    // 读入字符串，反转后输出\n    return 0;\n}\n",
    ["用 string s; cin >> s; 读入", "reverse(s.begin(), s.end()) 需要 #include <algorithm>"],
    "## 题解\n\n```cpp\nstring s;\ncin >> s;\nreverse(s.begin(), s.end());\ncout << s << endl;\n```\n\nreverse 是 <algorithm> 里的标准算法，直接原地反转。",
    [
      { stdin: "abc\n", expected_stdout: "cba\n" },
      { stdin: "cpp\n", expected_stdout: "ppc\n" },
    ]),
  cpp("cpp-004", "1 到 n 求和（C++）", 1, ["循环"],
    "## 1 到 n 求和\n\n输入 n（n ≤ 10000），输出 1+2+...+n。",
    "#include <iostream>\n\nint main() {\n    // 累加 1 到 n 并输出\n    return 0;\n}\n",
    ["for (int i = 1; i <= n; i++) sum += i;", "或者直接用公式 n * (n + 1) / 2"],
    "## 题解\n\n```cpp\nint n; cin >> n;\nlong long sum = 0;\nfor (int i = 1; i <= n; i++) sum += i;\ncout << sum << endl;\n```",
    [
      { stdin: "10\n", expected_stdout: "55\n" },
      { stdin: "100\n", expected_stdout: "5050\n" },
    ]),
];

const targets = [
  WS + "/bank",
  PROJ + "/portable/workspace/bank",
];
for (const dir of targets) {
  for (const q of questions) fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
}
console.log("C++ 题库生成:", questions.length, "道");
