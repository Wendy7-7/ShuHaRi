// 统计最小集题库：6 道（scipy/numpy，美赛课程第 4 阶段硬门槛）
const fs = require("fs");
const path = require("path");
const os = require("os");
const WS = process.env.LEARN_WORKSPACE || path.join(os.homedir(), "learn-workspace");

function q(id, title, diff, stmt, starter, hints, editorial, expected) {
  return {
    id, lang: "python", title, difficulty: diff,
    tags: ["数学建模", "统计"],
    statement_md: stmt,
    starter_code: starter,
    hints,
    editorial_md: editorial,
    test_cases: [{ stdin: "", expected_stdout: expected, timeout_ms: 25000, match_mode: "contains" }],
  };
}

const DATA_HINT = "\n\n**数据已写进代码里**（美赛阶段先小数据练手，等 pandas 熟了再接真数据集）。\n";

const questions = [
  q("st-01", "描述统计：均值、中位数、标准差", 1,
    "## 描述统计：均值、中位数、标准差\n\n这是统计最小集第一课：先会描述数据，再谈推断。\n\n**任务**：对数组 `[52, 55, 61, 64, 64, 68, 70, 75, 78, 83]` 计算均值、中位数、标准差（样本标准差），按顺序打印，各保留 2 位小数。" + DATA_HINT,
    "import numpy as np\n\nx = np.array([52, 55, 61, 64, 64, 68, 70, 75, 78, 83])\n\n# 打印 mean / median / std（样本标准差，ddof=1），各保留 2 位小数\n",
    ["np.mean / np.median / np.std(x, ddof=1)", "格式化输出：f'{v:.2f}'——注意每行一个数"],
    "## 题解\n\n```python\nprint(f\"{np.mean(x):.2f}\")\nprint(f\"{np.median(x):.2f}\")\nprint(f\"{np.std(x, ddof=1):.2f}\")\n```\n\n**关键点**：`ddof=1` 才是样本标准差（除以 n-1）。用默认的总体标准差（除以 n）在美赛里会被 reviewer 挑出来。",
    "67.00"),

  q("st-02", "相关系数：学习时长与分数", 2,
    "## 相关系数\n\n**任务**：两组数据——每周学习时长 `h = [2, 4, 6, 8, 10, 12]`，对应成绩 `s = [55, 58, 64, 68, 75, 80]`。计算 Pearson 相关系数，保留 3 位小数打印。" + DATA_HINT,
    "import numpy as np\n\nh = np.array([2, 4, 6, 8, 10, 12])\ns = np.array([55, 58, 64, 68, 75, 80])\n\n# 打印 Pearson 相关系数，保留 3 位小数\n",
    ["np.corrcoef(h, s) 返回 2x2 矩阵，取 [0, 1]", "或者 scipy.stats.pearsonr(h, s)[0]"],
    "## 题解\n\n```python\nprint(f\"{np.corrcoef(h, s)[0, 1]:.3f}\")\n```\n\n结果 ≈ 0.995——高度正相关。**美赛写作**：报告相关系数时必须注明是 Pearson 还是 Spearman，样本量多少。",
    "0.99"),

  q("st-03", "一元线性回归", 2,
    "## 一元线性回归\n\n**任务**：用 `st-02` 的数据拟合直线 `s = a·h + b`，打印斜率 a 和截距 b，各保留 3 位小数。" + DATA_HINT,
    "import numpy as np\n\nh = np.array([2, 4, 6, 8, 10, 12])\ns = np.array([55, 58, 64, 68, 75, 80])\n\n# 拟合 s = a*h + b，打印 a 和 b（各 3 位小数，各占一行）\n",
    ["np.polyfit(h, s, 1) 返回 [斜率, 截距]", "或者 scipy.stats.linregress(h, s) 的 .slope / .intercept"],
    "## 题解\n\n```python\na, b = np.polyfit(h, s, 1)\nprint(f\"{a:.3f}\")\nprint(f\"{b:.3f}\")\n```\n\n**美赛视角**：回归结果要配图（散点+拟合线）和 R² 才有说服力——matplotlib 模块你已经会了。",
    "2.443"),

  q("st-04", "t 检验与 p 值", 3,
    "## t 检验与 p 值\n\n两组学生用不同学习方法，分数：\n- A 法：`[72, 75, 78, 80, 82]`\n- B 法：`[68, 70, 74, 76, 79, 81]`\n\n**任务**：做独立样本 t 检验，打印 p 值（保留 4 位小数）和新的一行结论：p < 0.05 则打印 `显著`，否则打印 `不显著`。" + DATA_HINT,
    "from scipy import stats\n\na = [72, 75, 78, 80, 82]\nb = [68, 70, 74, 76, 79, 81]\n\n# 独立样本 t 检验：打印 p 值（4 位小数），再打印 显著/不显著\n",
    ["stats.ttest_ind(a, b) 返回 (t 统计量, p 值)", "结论行用条件表达式：'显著' if p < 0.05 else '不显著'"],
    "## 题解\n\n```python\nt, p = stats.ttest_ind(a, b)\nprint(f\"{p:.4f}\")\nprint(\"显著\" if p < 0.05 else \"不显著\")\n```\n\np ≈ 0.25 → 不显著。**统计最小集的核心思想**：眼看着 B 法均值低一点，但统计告诉你这点差异可能纯属随机——这正是没学统计的人最容易踩的坑。",
    "0.2"),

  q("st-05", "参数拟合 curve_fit", 3,
    "## 参数拟合 curve_fit\n\n指数衰减模型 `y = A·exp(-k·t)`，观测数据：\n- t = [0, 1, 2, 3, 4]\n- y = [10.0, 6.1, 3.7, 2.2, 1.4]\n\n**任务**：用 `scipy.optimize.curve_fit` 拟合 A 和 k，各保留 2 位小数打印。" + DATA_HINT,
    "import numpy as np\nfrom scipy.optimize import curve_fit\n\nt = np.array([0, 1, 2, 3, 4])\ny = np.array([10.0, 6.1, 3.7, 2.2, 1.4])\n\ndef model(t, A, k):\n    return A * np.exp(-k * t)\n\n# 拟合并打印 A、k（各 2 位小数）\n",
    ["curve_fit(model, t, y) 返回 (最优参数, 协方差)", "参数是数组 popt，popt[0] 是 A，popt[1] 是 k"],
    "## 题解\n\n```python\npopt, _ = curve_fit(model, t, y)\nprint(f\"{popt[0]:.2f}\")\nprint(f\"{popt[1]:.2f}\")\n```\n\nA ≈ 10，k ≈ 0.5。**美赛高频**：放射性衰减、药物代谢、阻尼振动全是这个模型。",
    "10.0"),

  q("st-06", "ODE 数值求解 solve_ivp", 3,
    "## ODE 数值求解\n\n解微分方程 `dy/dt = -0.5·y`，初值 `y(0) = 100`，求 `t = 4` 时的 y 值，保留 2 位小数打印。" + DATA_HINT,
    "import numpy as np\nfrom scipy.integrate import solve_ivp\n\n# dy/dt = -0.5y, y(0)=100，求 y(4)\n\ndef rhs(t, y):\n    return -0.5 * y\n\n# 用 solve_ivp 求解并打印 y(4)（2 位小数）\n",
    ["solve_ivp(rhs, [0, 4], [100]) 的 .y 是解数组，取最后一个", "sol.y[0][-1] 就是 y(4)"],
    "## 题解\n\n```python\nsol = solve_ivp(rhs, [0, 4], [100])\nprint(f\"{sol.y[0][-1]:.2f}\")\n```\n\n结果 ≈ 13.53（解析解 100·e^(-2) ≈ 13.53，对上了）。**美赛 SIR 传染模型**就是三个耦合 ODE，套路完全一样。",
    "13.53"),
];

const targets = [
  path.join(WS, "bank"),
  path.join(__dirname, "portable", "workspace", "bank"),
];
for (const dir of targets) {
  for (const q of questions) fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
}
console.log("统计题库生成:", questions.length, "道");
