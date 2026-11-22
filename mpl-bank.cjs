// matplotlib 美赛题库：5 道"存图"型任务（expect_file + dpi 300 校验）
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const fs = require("fs");
const path = require("path");

function q(id, title, diff, stmt, starter, hints, editorial, figPath) {
  return {
    id, lang: "python", title, difficulty: diff,
    tags: ["数学建模", "matplotlib"],
    statement_md: stmt,
    starter_code: starter,
    hints,
    editorial_md: editorial,
    test_cases: [{
      stdin: "", expected_stdout: "", timeout_ms: 25000,
      expect_file: { path: figPath, min_bytes: 3000, dpi: 300 },
    }],
  };
}

const HEADER = "import os\nimport pandas as pd\nimport matplotlib\nmatplotlib.use(\"Agg\")  # 无界面环境也能保存图片\nimport matplotlib.pyplot as plt\n\nos.makedirs(\"figures\", exist_ok=True)\n\n";

const questions = [
  q("mpl-01", "图 1：年度平均分折线", 1,
    "## 图 1：年度平均分折线\n\n论文里最常见的图：趋势。\n\n**任务**：读入 `mcm/matplotlib_kit/data/year_trend.csv`，画平均分（avg_score）随年份（year）变化的折线图，要求：\n- 圆点标记（marker）\n- 标题、X/Y 轴标签（Y 轴注明「分」）\n- X 轴只显示整数年份刻度（2024/2025/2026）\n- Y 轴范围 0–100\n- **以 300 dpi 保存为 `figures/year_line.png`**\n\n> 美赛论文的图片要求印刷级 dpi，300 是底线。",
    HEADER + "df = pd.read_csv(\"mcm/matplotlib_kit/data/year_trend.csv\")\n\n# 你的代码：折线图 + 刻度 + 保存\n",
    ["plt.plot(df['year'], df['avg_score'], marker='o')", "整数刻度：plt.xticks(df['year'])", "plt.ylim(0, 100)，最后 plt.savefig('figures/year_line.png', dpi=300)"],
    "## 题解\n\n```python\nplt.figure(figsize=(6, 4))\nplt.plot(df['year'], df['avg_score'], marker='o')\nplt.title('Average Score by Year')\nplt.xlabel('Year')\nplt.ylabel('Score (points)')\nplt.xticks(df['year'])\nplt.ylim(0, 100)\nplt.tight_layout()\nplt.savefig('figures/year_line.png', dpi=300)\n```\n\n**检查点**：判题会验证文件存在且 dpi=300——忘记 dpi 参数默认只有 100。",
    "figures/year_line.png"),

  q("mpl-02", "图 2：各学校降序柱状图", 2,
    "## 图 2：各学校降序柱状图\n\n**任务**：读入 `mcm/matplotlib_kit/data/school_summary.csv`，画**按平均分降序**的柱状图：\n- 柱顶标注平均分数值（保留 2 位小数）\n- X 轴标签同时带样本量（如 `XJTLU(n=7)`）\n- **以 300 dpi 保存为 `figures/school_bar.png`**\n\n> 读者既要看均值也要看样本量——n=2 的 81 分和 n=7 的 81 分不是一个分量。",
    HEADER + "df = pd.read_csv(\"mcm/matplotlib_kit/data/school_summary.csv\")\n\n# 你的代码：降序柱状 + 柱顶标注 + 保存\n",
    ["先 df.sort_values('avg_score', ascending=False)", "柱顶标注：ax.bar_label(bars, fmt='%.2f')", "X 轴标签：df['school'] + '(n=' + df['teams'].astype(str) + ')'"],
    "## 题解\n\n```python\ndf = df.sort_values('avg_score', ascending=False)\nlabels = df['school'] + '(n=' + df['teams'].astype(str) + ')'\nfig, ax = plt.subplots(figsize=(6, 4))\nbars = ax.bar(labels, df['avg_score'])\nax.bar_label(bars, fmt='%.2f')\nax.set_ylabel('Average Score')\nplt.tight_layout()\nplt.savefig('figures/school_bar.png', dpi=300)\n```",
    "figures/school_bar.png"),

  q("mpl-03", "图 3：学习时长与分数散点图", 2,
    "## 图 3：学习时长与分数散点图\n\n**任务**：读入 `mcm/matplotlib_kit/data/score_hours.csv`，画 hours（学习时长）vs score（分数）的散点图：\n- 按 college 分组着色（不同学院不同颜色，带图例）\n- 标题与轴标签\n- **以 300 dpi 保存为 `figures/hours_scatter.png`**\n\n> 美赛里「投入与产出」关系图几乎是必备——评委爱看这个。",
    HEADER + "df = pd.read_csv(\"mcm/matplotlib_kit/data/score_hours.csv\")\n\n# 你的代码：按学院着色的散点图 + 保存\n",
    ["按 college 分组循环：for name, g in df.groupby('college'): plt.scatter(g['hours'], g['score'], label=name)", "别忘了 plt.legend()"],
    "## 题解\n\n```python\nplt.figure(figsize=(6, 4))\nfor name, g in df.groupby('college'):\n    plt.scatter(g['hours'], g['score'], label=name, s=50)\nplt.xlabel('Hours spent')\nplt.ylabel('Score')\nplt.title('Study Hours vs Score')\nplt.legend()\nplt.tight_layout()\nplt.savefig('figures/hours_scatter.png', dpi=300)\n```",
    "figures/hours_scatter.png"),

  q("mpl-04", "图 4：双 Y 轴看趋势与规模", 3,
    "## 图 4：双 Y 轴看趋势与规模\n\n**任务**：读入 `mcm/matplotlib_kit/data/year_trend.csv`，画**双 Y 轴**图：\n- 左轴：平均分折线（avg_score）\n- 右轴：队伍数（teams），用不同颜色区分\n- 两轴各自标签 + 标题\n- **以 300 dpi 保存为 `figures/year_twinx.png`**\n\n> 平均分降了但队伍数涨了——双轴能把「质量」和「规模」的变化放在一张图里。",
    HEADER + "df = pd.read_csv(\"mcm/matplotlib_kit/data/year_trend.csv\")\n\n# 你的代码：twinx 双轴图 + 保存\n",
    ["ax2 = ax1.twinx() 创建共享 X 的第二根 Y 轴", "ax1 画 avg_score，ax2 画 teams，分别 set_ylabel"],
    "## 题解\n\n```python\nfig, ax1 = plt.subplots(figsize=(6, 4))\nax1.plot(df['year'], df['avg_score'], 'o-', color='tab:blue')\nax1.set_ylabel('Average Score', color='tab:blue')\nax2 = ax1.twinx()\nax2.plot(df['year'], df['teams'], 's--', color='tab:red')\nax2.set_ylabel('Teams', color='tab:red')\nax1.set_xticks(df['year'])\nplt.title('Score vs Team Count')\nplt.tight_layout()\nplt.savefig('figures/year_twinx.png', dpi=300)\n```",
    "figures/year_twinx.png"),

  q("mpl-05", "图 5：把最高分标出来", 3,
    "## 图 5：把最高分标出来\n\n**任务**：读入 `mcm/matplotlib_kit/data/team_scores.csv`，画所有队伍的散点图（X=年份，Y=分数），并用**箭头标注**分数最高的那支队伍（标出 team_id 和分数）。\n- **以 300 dpi 保存为 `figures/annotated_scores.png`**\n\n> 标注（annotate）是让图「会说话」的关键：别只给数据，给读者指重点。",
    HEADER + "df = pd.read_csv(\"mcm/matplotlib_kit/data/team_scores.csv\")\n\n# 你的代码：散点 + 最高分箭头标注 + 保存\n",
    ["最高点：idx = df['score'].idxmax()，取 df.loc[idx]", "plt.annotate(text, xy=(x, y), xytext=(x2, y2), arrowprops=dict(arrowstyle='->'))"],
    "## 题解\n\n```python\nplt.figure(figsize=(6, 4))\nplt.scatter(df['year'], df['score'], s=40)\nidx = df['score'].idxmax()\ntop = df.loc[idx]\nplt.annotate(f\"{top['team_id']}: {top['score']}\",\n             xy=(top['year'], top['score']),\n             xytext=(top['year'] - 0.5, top['score'] + 6),\n             arrowprops=dict(arrowstyle='->'))\nplt.xlabel('Year')\nplt.ylabel('Score')\nplt.title('Team Scores with Top Annotated')\nplt.tight_layout()\nplt.savefig('figures/annotated_scores.png', dpi=300)\n```",
    "figures/annotated_scores.png"),
];

const targets = [
  WS + "/bank",
  PROJ + "/portable/workspace/bank",
];
for (const dir of targets) {
  for (const q of questions) fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
}
console.log("matplotlib 题库生成:", questions.length, "道");
