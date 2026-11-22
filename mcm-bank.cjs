// pandas 美赛题库：10 道基于课程数据集的可判题任务（contains 匹配）
const WS = process.env.LEARN_WORKSPACE || require("path").join(require("os").homedir(), "learn-workspace");
const PROJ = __dirname;

const fs = require("fs");
const path = require("path");

const L1 = "mcm/pandas_kit/data/level1_contest_raw.csv";
const L2S = "mcm/pandas_kit/data/level2_scores_raw.csv";
const L2T = "mcm/pandas_kit/data/level2_teams_raw.csv";

function q(id, title, diff, stmt, starter, hints, editorial, expected) {
  return {
    id, lang: "python", title, difficulty: diff,
    tags: ["数学建模", "pandas"],
    statement_md: stmt,
    starter_code: starter,
    hints,
    editorial_md: editorial,
    test_cases: [{ stdin: "", expected_stdout: expected, timeout_ms: 20000, match_mode: "contains" }],
  };
}

const questions = [
  q("py-mcm-01", "Day 1：第一次读入赛题数据", 1,
    "## Day 1：第一次读入赛题数据\n\n美赛任何一道题，第一步都是把数据读进来。\n\n**任务**：用 pandas 读入 `" + L1 + "`，赋值给 `df`，然后打印 `df.shape`。\n\n**验收**：输出包含 `(22, 5)`。\n\n> 这份数据是某年校级选拔赛的原始记录，有 22 行。你的工作是先把它看清楚，再谈清洗。",
    "# 第一次读入赛题数据\nimport pandas as pd\n\n# 1. 读入 CSV（路径已给出，想想为什么是相对工作区根目录的）\ndf = pd.read_csv(\"" + L1 + "\")\n\n# 2. 打印 df.shape，看看是多少行多少列\n",
    ["pandas 的读入函数叫什么？提示：pd.read_???", "print(df.shape) 会输出 (行数, 列数)"],
    "## 题解\n\n```python\nimport pandas as pd\ndf = pd.read_csv(\"" + L1 + "\")\nprint(df.shape)\n```\n\n输出 `(22, 5)` 即通过。\n\n**美赛视角**：拿到赛题数据先看形状，能立刻发现「行数对不上」这类问题。",
    "(22, 5)"),

  q("py-mcm-02", "Day 2：列名里藏着的空格", 1,
    "## Day 2：列名里藏着的空格\n\n这份数据的列名 `" + " School " + "` 两端有空格——直接 `df['School']` 会报 KeyError。\n\n**任务**：读入 `" + L1 + "`，把**所有列名首尾空格去掉**，然后打印 `list(df.columns)`。\n\n**验收**：输出包含 `'School', 'Year'`（说明 School 两边的空格没了）。\n\n> 真实赛题数据里，列名带空格、全角字符、中文括号都常见。清洗第一步永远是列名。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\n\n# 1. 去掉所有列名的首尾空格（提示：df.columns 是可以批量处理的）\n\n# 2. 打印 list(df.columns)，检查 School 两边是否干净了\n",
    ["df.columns 是一个 Index，可以 .str.strip() 批量处理", "df.columns = df.columns.str.strip() 一行搞定"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\nprint(list(df.columns))\n```\n\n之后 `df['School']` 就能正常访问了。",
    "'School', 'Year'"),

  q("py-mcm-03", "Day 3：找出完全重复的行", 1,
    "## Day 3：找出完全重复的行\n\n这份数据里有一行被重复记录了（某个队伍出现了两次）。\n\n**任务**：读入 `" + L1 + "`，先按 Day 2 的方法清理列名，再打印**完全重复的行数**（`df.duplicated().sum()`）。\n\n**验收**：输出 `1`。\n\n> 重复行会让后面的平均分、计数全部失真。先发现，再决定怎么处理。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\n\n# 打印完全重复的行数\n",
    ["duplicated() 标记每一行是否与前面的行重复", "sum() 把 True 当 1 计数"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\nprint(df.duplicated().sum())\n```\n\n想看具体哪一行重复？`df[df.duplicated(keep=False)]` 会把重复的行都显示出来——原来是 T09 被记了两次。",
    "1"),

  q("py-mcm-04", "Day 4：每列缺了多少个值", 1,
    "## Day 4：每列缺了多少个值\n\n**任务**：读入 `" + L1 + "`，清理列名后，打印每列缺失值数量的**字典**（`df.isna().sum().to_dict()`）。\n\n**验收**：输出包含 `'Year': 1`（Year 列恰好缺 1 个）。\n\n> 先量化缺失，再决定填还是删。Year 和 Members 各有 1 个缺失，你能都看到吗？",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\n\n# 打印每列缺失值数量的字典\n",
    ["isna() 返回同形状的布尔表", "sum() 按列计数，to_dict() 转成字典方便看"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\nprint(df.isna().sum().to_dict())\n```\n\n应该看到 Year 和 Members 各缺 1 个。",
    "'Year': 1"),

  q("py-mcm-05", "Day 5：同一所学校有 4 种写法", 2,
    "## Day 5：同一所学校有 4 种写法\n\n`School` 列里 XJTLU 有 `XJTLU`、`xjtlu `、` XJTLU`、`xjtlu` 等写法。\n\n**任务**：清理列名后，把 School 列**统一为去首尾空格 + 全大写**，然后统计统一后 XJTLU 出现的**行数**并打印。\n\n**验收**：输出 `9`（包含那条重复记录）。\n\n> 不统一写法就 groupby，同一所学校会被拆成 4 组——这是美赛数据清洗最常见的坑。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\n\n# 1. 统一 School 列：去空格 + 大写\n\n# 2. 统计统一后 XJTLU 的行数并打印\n",
    ["df['School'].str.strip().str.upper()", "统计某个值出现次数：(df['School'] == 'XJTLU').sum()"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\nprint((df['School'] == 'XJTLU').sum())\n```\n\n统一后 XJTLU 有 9 行（含重复行）。顺手打印 `df['School'].value_counts()` 看看其他学校各几行。",
    "9"),

  q("py-mcm-06", "Day 6：把「缺考」变成真正的缺失", 2,
    "## Day 6：把「缺考」变成真正的缺失\n\n`Score` 列里混着中文「缺考」和空值，导致整列被 pandas 当成文本。\n\n**任务**：清理列名后，用 `pd.to_numeric(df['Score'], errors='coerce')` 把 Score 转成数值（无法转换的变 NaN），再打印**转换后非空值的数量**。\n\n**验收**：输出 `19`（22 行 - 2 个「缺考」 - 1 个原本就空的）。\n\n> coerce = 转不了就变缺失，比直接报错更适合脏数据。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\n\n# 1. Score 转数值（errors='coerce'）\n\n# 2. 打印转换后非空值的数量\n",
    ["to_numeric 的 errors 参数有三个选择：raise / coerce / ignore，想想为什么用 coerce", "notna().sum() 统计非空个数"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['Score'] = pd.to_numeric(df['Score'], errors='coerce')\nprint(df['Score'].notna().sum())\n```\n\n转换后 Score 变成 float 列，「缺考」和空值都是 NaN——之后才能算平均分。",
    "19"),

  q("py-mcm-07", "Day 7：XJTLU 的平均分是多少", 2,
    "## Day 7：XJTLU 的平均分是多少\n\n**任务**：在 Day 5、6 的基础上（列名清理 + School 统一 + Score 数值化），计算 **XJTLU 的平均分**，保留 2 位小数打印。\n\n**验收**：输出包含 `83.5`。\n\n> 注意：平均分要跳过 NaN（pandas 的 mean 默认跳过），重复行要不要先去？这题先不去重。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score'] = pd.to_numeric(df['Score'], errors='coerce')\n\n# 计算 XJTLU 的平均分，保留 2 位小数打印\n",
    ["先筛选 df[df['School'] == 'XJTLU']，再取 Score.mean()", "round(x, 2) 或 f'{x:.2f}' 都能保留两位小数"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score'] = pd.to_numeric(df['Score'], errors='coerce')\nxj = df[df['School'] == 'XJTLU']\nprint(round(xj['Score'].mean(), 2))\n```\n\n结果 83.5。如果先 drop_duplicates 去掉重复行，均值会变成 82.25——体会「清洗顺序影响结果」。",
    "83.5"),

  q("py-mcm-08", "Day 8：合并两表时多出来的那一行", 3,
    "## Day 8：合并两表时多出来的那一行\n\n`level2_scores_raw.csv`（16 行成绩）和 `level2_teams_raw.csv`（队伍信息）要用 `team_id` 合并。\n\n**陷阱**：两表的 team_id 有大小写和空格不一致，而且 teams 表里 team_id 有重复键。\n\n**任务**：\n1. 两表 team_id 都清洗为去空格 + 大写\n2. **不做任何去重**，直接 `pd.merge(scores, teams, on='team_id')`\n3. 打印合并后的 `merged.shape`\n\n**验收**：输出包含 `(17, 7)`——比 scores 的 16 行多了 1 行！\n\n> 想想为什么会多一行？这就是 merge 的「一对多膨胀」。下一题我们解决它。",
    "import pandas as pd\n\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\n\n# 1. 两表 team_id 清洗（去空格 + 大写）\n\n# 2. 直接 merge，打印 merged.shape\n",
    ["两列都 .str.strip().str.upper()", "pd.merge(scores, teams, on='team_id')", "打印 merged.shape 看行数——为什么会多？"],
    "## 题解\n\n```python\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\nmerged = pd.merge(scores, teams, on='team_id')\nprint(merged.shape)\n```\n\n结果 (17, 7)：teams 里 T16 出现了两次，merge 时一条成绩配上了两条队伍信息，行数就膨胀了。",
    "(17, 7)"),

  q("py-mcm-09", "Day 9：先去重再合并", 2,
    "## Day 9：先去重再合并\n\n**任务**：在 Day 8 基础上，合并**之前**先给 teams 按 team_id 去重（保留第一条），再 merge 并打印 shape。\n\n**验收**：输出包含 `(16, 7)`——行数回到 scores 的 16 行。\n\n> 什么时候去重？在合并的「右表」（被查字典的那张表）上。这是 merge 防膨胀的标准动作。",
    "import pandas as pd\n\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\n\n# 1. teams 按 team_id 去重\n\n# 2. 合并并打印 shape\n",
    ["teams.drop_duplicates(subset='team_id')", "drop_duplicates 默认 keep='first'，保留第一次出现的行"],
    "## 题解\n\n```python\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\nteams = teams.drop_duplicates(subset='team_id')\nmerged = pd.merge(scores, teams, on='team_id')\nprint(merged.shape)\n```\n\n去重后合并结果 (16, 7)，每行成绩恰好对应一条队伍信息。",
    "(16, 7)"),

  q("py-mcm-10", "Day 10：哪所学校平均分最高", 3,
    "## Day 10：哪所学校平均分最高\n\n**任务**：在 Day 5、6 基础上（School 统一 + Score 数值化），按学校分组求平均分，找出**平均分最高的学校**，以 `学校名 平均分（2位小数）` 的格式打印。\n\n**验收**：输出包含 `SJTU 83.67`。\n\n> 小心：XJTLU 的平均分是 83.5，非常接近——如果你算出来最高是 XJTLU，多半是把「缺考」当成 0 分了。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score'] = pd.to_numeric(df['Score'], errors='coerce')\n\n# 按学校分组求平均分，找出最高的一所，按格式打印\n",
    ["df.groupby('School')['Score'].mean() 得到每校平均分", "sort_values(ascending=False) 后取第一行", "格式化：f'{school} {mean:.2f}'"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score'] = pd.to_numeric(df['Score'], errors='coerce')\nmeans = df.groupby('School')['Score'].mean().sort_values(ascending=False)\nprint(f'{means.index[0]} {means.iloc[0]:.2f}')\n```\n\n结果 SJTU 83.67。把「缺考」当 0 分会把 SJTU 的均值拉到 62.75——这就是为什么 NaN 处理决定结论。",
    "SJTU 83.67"),
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
console.log("pandas 题库生成:", questions.length, "道");
