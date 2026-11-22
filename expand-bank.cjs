// 题库扩容：生成 18 道新题（C +7 / Python +6 / Java +5），覆盖分支/循环/数组/字符串/数学
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const fs = require("fs");
const path = require("path");

const C_STARTER_BASIC = "#include <stdio.h>\n\nint main(void) {\n";

function cQ(id, title, diff, tags, stmt, body, hints, editorial, cases) {
  return {
    id, lang: "c", title, difficulty: diff, tags,
    statement_md: stmt,
    starter_code: "#include <stdio.h>\n\nint main(void) {\n    // " + body + "\n    return 0;\n}\n",
    hints, editorial_md: editorial, test_cases: cases,
  };
}
function pyQ(id, title, diff, tags, stmt, body, hints, editorial, cases) {
  return {
    id, lang: "python", title, difficulty: diff, tags,
    statement_md: stmt,
    starter_code: "# " + body + "\n",
    hints, editorial_md: editorial, test_cases: cases,
  };
}
function jQ(id, title, diff, tags, stmt, body, hints, editorial, cases) {
  return {
    id, lang: "java", title, difficulty: diff, tags,
    statement_md: stmt,
    starter_code: "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // " + body + "\n    }\n}\n",
    hints, editorial_md: editorial, test_cases: cases,
  };
}

const questions = [
  // ===== C =====
  cQ("c-004", "闰年判断", 1, ["分支"],
    "## 闰年判断\n\n输入一个年份，判断它是不是闰年。\n\n**输入**：一个整数 year\n\n**输出**：闰年输出 `leap`，否则输出 `common`\n\n规则：能被 4 整除但不能被 100 整除，或者能被 400 整除。",
    "读入年份，判断是否闰年",
    ["用 % 取余判断整除：year % 4 == 0", "注意两个条件的优先级：先判断 400，再判断 4 且非 100"],
    "## 题解\n\n```c\nif (year % 400 == 0 || (year % 4 == 0 && year % 100 != 0)) printf(\"leap\\n\");\nelse printf(\"common\\n\");\n```\n\n常见错误：写成 `year % 4 == 0 && year % 100 != 0 || year % 400 == 0` 后优先级理解错——&& 比 || 优先级高，其实等价，但加括号更清晰。",
    [
      { stdin: "2000\n", expected_stdout: "leap\n" },
      { stdin: "1900\n", expected_stdout: "common\n" },
      { stdin: "2024\n", expected_stdout: "leap\n" },
    ]),
  cQ("c-005", "1 到 n 求和", 1, ["循环"],
    "## 1 到 n 求和\n\n输入一个正整数 n，输出 1+2+...+n 的结果。\n\n**输入**：一个整数 n（n ≤ 10000）\n\n**输出**：累加和",
    "循环累加 1 到 n",
    ["用 for 循环从 1 加到 n，累加器初值 0", "n 到 10000 时和不超过 50005000，int 够用"],
    "## 题解\n\n```c\nint sum = 0;\nfor (int i = 1; i <= n; i++) sum += i;\nprintf(\"%d\\n\", sum);\n```\n\n数学公式 n*(n+1)/2 也成立，但练习目的就是让你写循环。",
    [
      { stdin: "10\n", expected_stdout: "55\n" },
      { stdin: "1\n", expected_stdout: "1\n" },
      { stdin: "100\n", expected_stdout: "5050\n" },
    ]),
  cQ("c-006", "n 的阶乘", 1, ["循环"],
    "## n 的阶乘\n\n输入一个正整数 n（n ≤ 12），输出 n! = 1×2×…×n。\n\n**输入**：一个整数 n\n\n**输出**：n 的阶乘",
    "循环累乘 1 到 n",
    ["累乘器初值必须是 1（不能是 0，0 乘任何数都是 0）", "12! = 479001600，int 放得下"],
    "## 题解\n\n```c\nlong long f = 1;\nfor (int i = 2; i <= n; i++) f *= i;\nprintf(\"%lld\\n\", f);\n```\n\n经典坑：把累乘器初始化为 0。",
    [
      { stdin: "5\n", expected_stdout: "120\n" },
      { stdin: "1\n", expected_stdout: "1\n" },
      { stdin: "12\n", expected_stdout: "479001600\n" },
    ]),
  cQ("c-007", "数组最大值", 2, ["数组"],
    "## 数组最大值\n\n先输入 n，再输入 n 个整数，输出其中最大的。\n\n**输入**：第一行 n（1 ≤ n ≤ 100），第二行 n 个整数\n\n**输出**：最大值",
    "读入 n 和数组，找最大值",
    ["先读 n，再循环读 n 个数", "初始化最大值时，用第一个元素而不是用 0——数组全为负数时就靠这个"],
    "## 题解\n\n```c\nint a[100], n;\nscanf(\"%d\", &n);\nfor (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\nint mx = a[0];\nfor (int i = 1; i < n; i++) if (a[i] > mx) mx = a[i];\nprintf(\"%d\\n\", mx);\n```",
    [
      { stdin: "5\n3 7 2 9 4\n", expected_stdout: "9\n" },
      { stdin: "3\n-5 -2 -8\n", expected_stdout: "-2\n" },
      { stdin: "1\n42\n", expected_stdout: "42\n" },
    ]),
  cQ("c-008", "数组逆序输出", 2, ["数组"],
    "## 数组逆序输出\n\n输入 n 个整数，按相反顺序输出，用空格分隔。\n\n**输入**：第一行 n（1 ≤ n ≤ 100），第二行 n 个整数\n\n**输出**：逆序后的 n 个整数（空格分隔）",
    "读入数组后从后往前输出",
    ["读入后从下标 n-1 遍历到 0", "空格分隔：除最后一个外，每输出一个数加一个空格（或判断 i>0 时先输出空格）"],
    "## 题解\n\n```c\nfor (int i = n - 1; i >= 0; i--) {\n    printf(\"%d\", a[i]);\n    if (i > 0) printf(\" \");\n}\nprintf(\"\\n\");\n```",
    [
      { stdin: "4\n1 2 3 4\n", expected_stdout: "4 3 2 1\n" },
      { stdin: "3\n10 20 30\n", expected_stdout: "30 20 10\n" },
      { stdin: "1\n5\n", expected_stdout: "5\n" },
    ]),
  cQ("c-009", "各位数字之和", 2, ["循环"],
    "## 各位数字之和\n\n输入一个正整数，输出它每一位数字的和。\n\n**输入**：一个正整数 n（n ≤ 10^9）\n\n**输出**：各位数字之和\n\n例如 1234 → 1+2+3+4 = 10",
    "反复 %10 取末位、/10 去掉末位",
    ["n % 10 取最后一位数字", "n /= 10 去掉最后一位；循环到 n == 0 为止"],
    "## 题解\n\n```c\nint s = 0;\nwhile (n > 0) { s += n % 10; n /= 10; }\nprintf(\"%d\\n\", s);\n```\n\n这是「数位处理」的模板套路，后面进制转换、回文判断都靠它。",
    [
      { stdin: "1234\n", expected_stdout: "10\n" },
      { stdin: "9\n", expected_stdout: "9\n" },
      { stdin: "1000000000\n", expected_stdout: "1\n" },
    ]),
  cQ("c-010", "素数判断", 2, ["数学"],
    "## 素数判断\n\n输入一个整数 n（2 ≤ n ≤ 100000），判断它是不是素数。\n\n**输入**：一个整数 n\n\n**输出**：素数输出 `prime`，否则输出 `composite`",
    "试除 2 到 sqrt(n)",
    ["只需要试除到 sqrt(n)——若 i*i > n 还没找到因子就是素数", "1 和负数不是素数（本题 n ≥ 2 不用管）"],
    "## 题解\n\n```c\nint is_prime = 1;\nfor (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) { is_prime = 0; break; }\n}\nprintf(\"%s\\n\", is_prime ? \"prime\" : \"composite\");\n```\n\n不优化直接试除到 n 也能过，但 sqrt 优化是好习惯。",
    [
      { stdin: "7\n", expected_stdout: "prime\n" },
      { stdin: "8\n", expected_stdout: "composite\n" },
      { stdin: "2\n", expected_stdout: "prime\n" },
    ]),

  // ===== Python =====
  pyQ("py-003", "列表最大值", 1, ["数组"],
    "## 列表最大值\n\n输入一行用空格分隔的整数，输出最大值。\n\n**输入**：一行整数（至少 1 个）\n\n**输出**：最大值",
    "读一行数字，找出最大值",
    ["input().split() 把一行拆成字符串列表", "map(int, ...) 或列表推导转成整数", "也可以用内置的 max() 一行搞定"],
    "## 题解\n\n```python\nnums = list(map(int, input().split()))\nprint(max(nums))\n```",
    [
      { stdin: "3 7 2 9 4\n", expected_stdout: "9\n" },
      { stdin: "-5 -2 -8\n", expected_stdout: "-2\n" },
    ]),
  pyQ("py-004", "单词计数", 1, ["字符串"],
    "## 单词计数\n\n输入一行英文，统计有多少个单词（单词之间用空格分隔）。\n\n**输入**：一行文本\n\n**输出**：单词个数",
    "读一行文本，数单词个数",
    ["input().split() 会自动按任意空白切分并去掉多余空格", "len() 得到列表长度"],
    "## 题解\n\n```python\nprint(len(input().split()))\n```\n\nsplit() 不带参数时按任意空白切分，比 split(' ') 更稳（能处理连续空格）。",
    [
      { stdin: "hello world foo\n", expected_stdout: "3\n" },
      { stdin: "one\n", expected_stdout: "1\n" },
    ]),
  pyQ("py-005", "字符串反转", 1, ["字符串"],
    "## 字符串反转\n\n输入一个字符串，输出它的反转。\n\n**输入**：一行字符串（不含空格）\n\n**输出**：反转后的字符串",
    "读一个字符串，反转后输出",
    ["Python 的切片 s[::-1] 可以一步反转", "或者用 ''.join(reversed(s))"],
    "## 题解\n\n```python\ns = input().strip()\nprint(s[::-1])\n```\n\n切片 s[start:stop:step]，step 为 -1 就是从后往前取。",
    [
      { stdin: "abc\n", expected_stdout: "cba\n" },
      { stdin: "hello\n", expected_stdout: "olleh\n" },
    ]),
  pyQ("py-006", "阶乘（Python）", 1, ["循环"],
    "## 阶乘\n\n输入 n（n ≤ 12），输出 n!。\n\n**输入**：一个整数\n\n**输出**：n 的阶乘",
    "计算 n 的阶乘",
    ["result = 1，然后 for i in range(2, n+1): result *= i", "也可以 import math 用 math.factorial"],
    "## 题解\n\n```python\nn = int(input())\nr = 1\nfor i in range(2, n + 1):\n    r *= i\nprint(r)\n```",
    [
      { stdin: "5\n", expected_stdout: "120\n" },
      { stdin: "1\n", expected_stdout: "1\n" },
    ]),
  pyQ("py-007", "素数判断（Python）", 2, ["数学"],
    "## 素数判断\n\n输入 n（2 ≤ n ≤ 100000），是素数输出 `prime`，否则输出 `composite`。",
    "判断 n 是不是素数",
    ["试除 2 到 int(sqrt(n))+1", "别忘了 \"prime\" / \"composite\" 的拼写要和题目一致"],
    "## 题解\n\n```python\nimport math\nis_p = all(n % i for i in range(2, int(math.sqrt(n)) + 1))\nprint(\"prime\" if is_p else \"composite\")\n```",
    [
      { stdin: "7\n", expected_stdout: "prime\n" },
      { stdin: "9\n", expected_stdout: "composite\n" },
    ]),
  pyQ("py-008", "1 到 n 求和（Python）", 1, ["循环"],
    "## 1 到 n 求和\n\n输入 n，输出 1+2+...+n。",
    "循环累加或公式求和",
    ["for 循环累加，或者直接用公式 n*(n+1)//2（注意整除用 //）"],
    "## 题解\n\n```python\nn = int(input())\nprint(sum(range(1, n + 1)))\n```\n\nsum(range(...)) 是 Python 风格的写法。",
    [
      { stdin: "10\n", expected_stdout: "55\n" },
      { stdin: "100\n", expected_stdout: "5050\n" },
    ]),

  // ===== Java =====
  jQ("j-004", "1 到 n 求和（Java）", 1, ["循环"],
    "## 1 到 n 求和\n\n输入 n，输出 1+2+...+n。",
    "循环累加 1 到 n",
    ["for (int i = 1; i <= n; i++) sum += i;", "输出用 System.out.println(sum)"],
    "## 题解\n\n```java\nint n = sc.nextInt();\nint sum = 0;\nfor (int i = 1; i <= n; i++) sum += i;\nSystem.out.println(sum);\n```",
    [
      { stdin: "10\n", expected_stdout: "55\n", timeout_ms: 8000 },
      { stdin: "100\n", expected_stdout: "5050\n", timeout_ms: 8000 },
    ]),
  jQ("j-005", "数组最大值（Java）", 2, ["数组"],
    "## 数组最大值\n\n先输入 n，再输入 n 个整数，输出最大值。\n\n**输入**：第一行 n，第二行 n 个整数",
    "读入 n 和数组，找最大值",
    ["int[] a = new int[n]; 然后循环 a[i] = sc.nextInt();", "最大值初始化为 a[0]，从下标 1 开始比较"],
    "## 题解\n\n```java\nint n = sc.nextInt();\nint[] a = new int[n];\nfor (int i = 0; i < n; i++) a[i] = sc.nextInt();\nint mx = a[0];\nfor (int i = 1; i < n; i++) if (a[i] > mx) mx = a[i];\nSystem.out.println(mx);\n```",
    [
      { stdin: "5\n3 7 2 9 4\n", expected_stdout: "9\n", timeout_ms: 8000 },
      { stdin: "3\n-5 -2 -8\n", expected_stdout: "-2\n", timeout_ms: 8000 },
    ]),
  jQ("j-006", "素数判断（Java）", 2, ["数学"],
    "## 素数判断\n\n输入 n（2 ≤ n ≤ 100000），是素数输出 `prime`，否则输出 `composite`。",
    "判断 n 是否素数",
    ["试除到 i*i <= n", "用 boolean isPrime = true; 注意 break 的位置"],
    "## 题解\n\n```java\nboolean isPrime = true;\nfor (int i = 2; i * i <= n; i++) {\n    if (n % i == 0) { isPrime = false; break; }\n}\nSystem.out.println(isPrime ? \"prime\" : \"composite\");\n```",
    [
      { stdin: "7\n", expected_stdout: "prime\n", timeout_ms: 8000 },
      { stdin: "8\n", expected_stdout: "composite\n", timeout_ms: 8000 },
    ]),
  jQ("j-007", "字符串反转（Java）", 2, ["字符串"],
    "## 字符串反转\n\n输入一个字符串（不含空格），输出它的反转。",
    "读入字符串并反转输出",
    ["sc.next() 读一个单词", "new StringBuilder(s).reverse().toString() 一步反转"],
    "## 题解\n\n```java\nString s = sc.next();\nSystem.out.println(new StringBuilder(s).reverse().toString());\n```\n\nStringBuilder 的 reverse() 是原地反转，toString() 转回字符串。",
    [
      { stdin: "abc\n", expected_stdout: "cba\n", timeout_ms: 8000 },
      { stdin: "java\n", expected_stdout: "avaj\n", timeout_ms: 8000 },
    ]),
  jQ("j-008", "阶乘（Java）", 1, ["循环"],
    "## 阶乘\n\n输入 n（n ≤ 12），输出 n!。",
    "计算阶乘",
    ["long 更稳，避免 int 溢出风险", "累乘器初值 1"],
    "## 题解\n\n```java\nint n = sc.nextInt();\nlong f = 1;\nfor (int i = 2; i <= n; i++) f *= i;\nSystem.out.println(f);\n```",
    [
      { stdin: "5\n", expected_stdout: "120\n", timeout_ms: 8000 },
      { stdin: "12\n", expected_stdout: "479001600\n", timeout_ms: 8000 },
    ]),
];

const targets = [
  WS + "/bank",
  PROJ + "/portable/workspace/bank",
];
for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  for (const q of questions) {
    fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
  }
}
console.log("生成完成:", questions.length, "道题 →", targets.length, "个位置");
