// pandas 美赛题库：10 道基于课程数据集的可判题任务（contains 匹配）
const PROJ = __dirname;

const fs = require("fs");
const path = require("path");

const L1 = "mcm/pandas_kit/data/level1_contest_raw.csv";
const L2S = "mcm/pandas_kit/data/level2_scores_raw.csv";
const L2T = "mcm/pandas_kit/data/level2_teams_raw.csv";

function q(id, title, diff, stmt, starter, hints, editorial, expected, extra = {}) {
  const question = {
    id, lang: "python", title, difficulty: diff,
    tags: ["数学建模", "pandas"],
    statement_md: stmt,
    starter_code: starter,
    hints,
    editorial_md: editorial,
    reference_code: "import pandas as pd\n" + editorial.match(/```python\n([\s\S]*?)```/)[1],
    content_version: "1.1",
    test_cases: [{ stdin: "", expected_stdout: expected, timeout_ms: 20000, match_mode: "contains" }],
  };
  // 产物题（结构化校验）与变体用例：只在需要时写入，旧题字段保持原样。
  if (extra.expect_csv) question.test_cases[0].expect_csv = extra.expect_csv;
  if (extra.variant_cases) question.variant_cases = extra.variant_cases;
  return question;
}

const questions = [
  q("py-mcm-01", "Day 1：第一次读入赛题数据", 1,
    "## Day 1：第一次读入赛题数据\n\n美赛任何一道题，第一步都是把数据读进来。\n\n**任务**：用 pandas 读入 `" + L1 + "`，赋值给 `df`，然后打印 `df.shape`。\n\n**验收**：输出包含 `(22, 5)`。\n\n> 这份数据是教学用模拟选拔赛记录，有 22 行，不代表任何学校的真实表现。你的工作是先把它看清楚，再谈清洗。",
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
    "## Day 6：把「缺考」变成真正的缺失\n\n`Score` 列里混着中文「缺考」和空值，导致整列被 pandas 当成文本。\n\n**任务**：清理列名后，用 `pd.to_numeric(df['Score'], errors='coerce')` 把 Score 转成数值（无法转换的变 NaN），再打印**转换后非空值的数量**。\n\n**验收**：输出 `18`（22 行里有 2 个原始空值和 2 个「缺考」；转换后 4 个缺失、18 个有效分数）。\n\n> coerce 只负责数值转换，不解释缺失原因。转换前保留 Score_raw，分别标记 unknown（原始空值）、absent（缺考）、parse_error（其他解析失败）；本题不填补。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\n\n# 1. Score 转数值（errors='coerce'）\n\n# 2. 打印转换后非空值的数量\n",
    ["pandas 3.1.1 的 errors 参数支持 raise / coerce；转换前保留 Score_raw，才能区分原始空值、缺考和解析失败", "notna().sum() 统计非空个数"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['Score_raw'] = df['Score'].copy()\ndf['Score'] = pd.to_numeric(df['Score_raw'], errors='coerce')\ndf['Score_status'] = 'observed'\ndf.loc[df['Score_raw'].isna(), 'Score_status'] = 'unknown'\ndf.loc[df['Score_raw'].eq('缺考'), 'Score_status'] = 'absent'\ndf.loc[df['Score'].isna() & df['Score_raw'].notna() & ~df['Score_raw'].eq('缺考'), 'Score_status'] = 'parse_error'\nprint(df['Score'].notna().sum())\n```\n\n转换后数值列有 4 个 NaN，但 Score_raw 与 Score_status 仍保留空值/缺考/解析失败的区别。均值仅使用有效观测，不能据 NaN 就盲填。",
    "18"),

  q("py-mcm-07", "Day 7：XJTLU 的平均分是多少", 2,
    "## Day 7：XJTLU 的平均分是多少\n\n**任务**：在 Day 5、6 的基础上（列名清理 + School 统一 + Score 数值化），计算 **XJTLU 的平均分**，保留 2 位小数打印。\n\n**验收**：输出包含 `83.5`。\n\n> 注意：平均分要跳过 NaN（pandas 的 mean 默认跳过），重复行要不要先去？这题先不去重。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score_raw'] = df['Score'].copy()\ndf['Score'] = pd.to_numeric(df['Score_raw'], errors='coerce')\ndf['Score_status'] = 'observed'\ndf.loc[df['Score_raw'].isna(), 'Score_status'] = 'unknown'\ndf.loc[df['Score_raw'].eq('缺考'), 'Score_status'] = 'absent'\ndf.loc[df['Score'].isna() & df['Score_raw'].notna() & ~df['Score_raw'].eq('缺考'), 'Score_status'] = 'parse_error'\n\n# 计算 XJTLU 的平均分，保留 2 位小数打印\n",
    ["先筛选 df[df['School'] == 'XJTLU']，再取 Score.mean()", "round(x, 2) 或 f'{x:.2f}' 都能保留两位小数"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score_raw'] = df['Score'].copy()\ndf['Score'] = pd.to_numeric(df['Score_raw'], errors='coerce')\ndf['Score_status'] = 'observed'\ndf.loc[df['Score_raw'].isna(), 'Score_status'] = 'unknown'\ndf.loc[df['Score_raw'].eq('缺考'), 'Score_status'] = 'absent'\ndf.loc[df['Score'].isna() & df['Score_raw'].notna() & ~df['Score_raw'].eq('缺考'), 'Score_status'] = 'parse_error'\nxj = df[df['School'] == 'XJTLU']\nprint(round(xj['Score'].mean(), 2))\n```\n\n结果 83.5。如果先 drop_duplicates 去掉重复行，均值会变成 82.285714…（两位小数为 82.29）——体会「清洗顺序影响结果」。",
    "83.5"),

  q("py-mcm-08", "Day 8：合并两表时多出来的那一行", 3,
    "## Day 8：合并两表时多出来的那一行\n\n`level2_scores_raw.csv`（16 行成绩）和 `level2_teams_raw.csv`（队伍信息）要用 `team_id` 合并。\n\n**陷阱**：两表的 team_id 有大小写和空格不一致，而且 teams 表里 team_id 有重复键。\n\n**任务**：\n1. 两表 team_id 都清洗为去空格 + 大写\n2. **不做任何去重**，直接 `pd.merge(scores, teams, on='team_id')`\n3. 打印合并后的 `merged.shape`\n\n**验收**：输出包含 `(17, 7)`——比 scores 的 16 行多了 1 行！\n\n> 想想为什么会多一行？这就是 merge 的「一对多膨胀」。下一题我们解决它。",
    "import pandas as pd\n\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\n\n# 1. 两表 team_id 清洗（去空格 + 大写）\n\n# 2. 直接 merge，打印 merged.shape\n",
    ["两列都 .str.strip().str.upper()", "pd.merge(scores, teams, on='team_id')", "打印 merged.shape 看行数——为什么会多？"],
    "## 题解\n\n```python\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\nmerged = pd.merge(scores, teams, on='team_id')\nprint(merged.shape)\n```\n\n结果 (17, 7)：teams 里 T16 出现了两次，merge 时一条成绩配上了两条队伍信息，行数就膨胀了。",
    "(17, 7)"),

  q("py-mcm-09", "Day 9：先去重再合并", 2,
    "## Day 9：先去重再合并\n\n**任务**：在 Day 8 基础上，确认 T16 两行全列完全相同后，给 teams 全列去重，再用 `validate='many_to_one'` 合并并打印 shape。若重复键的其他字段冲突，必须报告并拒绝静默保留第一条。\n\n**验收**：本模拟数据输出包含 `(16, 7)`，冲突数据不得静默 keep='first'。\n\n> 右表是被查字典，键必须唯一；先检查重复记录的含义，再去重。",
    "import pandas as pd\n\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\n\n# 1. teams 只删全列重复行；键仍重复则报错\n\n# 2. 合并并打印 shape\n",
    ["teams.drop_duplicates() 只删除全列完全相同的行", "去重后 team_id 若仍重复则报告冲突；merge 加 validate='many_to_one'"],
    "## 题解\n\n```python\nscores = pd.read_csv(\"" + L2S + "\")\nteams = pd.read_csv(\"" + L2T + "\")\nfor d in (scores, teams):\n    d['team_id'] = d['team_id'].str.strip().str.upper()\nteams = teams.drop_duplicates()  # 只删除全列相同的记录\nif teams['team_id'].duplicated().any():\n    raise ValueError('team_id 存在冲突记录，拒绝静默保留第一条')\nmerged = pd.merge(scores, teams, on='team_id', validate='many_to_one')\nprint(merged.shape)\n```\n\n去重后合并结果 (16, 7)，每行成绩恰好对应一条队伍信息。",
    "(16, 7)"),

  q("py-mcm-10", "Day 10：哪所学校平均分最高", 3,
    "## Day 10：哪所学校平均分最高\n\n**任务**：在 Day 5、6 基础上（School 统一 + Score 数值化），按学校分组求平均分，找出**平均分最高的学校**，以 `学校名 平均分（2位小数）` 的格式打印。\n\n**验收**：输出包含 `SJTU 83.67`。\n\n> 本题保留重复记录，只统计有效观测分数；XJTLU 为 83.5，SJTU 为 83.666667。填零会改变统计口径，不能仅凭最高学校判断犯了哪种错误。",
    "import pandas as pd\n\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score_raw'] = df['Score'].copy()\ndf['Score'] = pd.to_numeric(df['Score_raw'], errors='coerce')\ndf['Score_status'] = 'observed'\ndf.loc[df['Score_raw'].isna(), 'Score_status'] = 'unknown'\ndf.loc[df['Score_raw'].eq('缺考'), 'Score_status'] = 'absent'\ndf.loc[df['Score'].isna() & df['Score_raw'].notna() & ~df['Score_raw'].eq('缺考'), 'Score_status'] = 'parse_error'\n\n# 按学校分组求平均分，找出最高的一所，按格式打印\n",
    ["df.groupby('School')['Score'].mean() 得到每校平均分", "sort_values(ascending=False) 后取第一行", "格式化：f'{school} {mean:.2f}'"],
    "## 题解\n\n```python\ndf = pd.read_csv(\"" + L1 + "\")\ndf.columns = df.columns.str.strip()\ndf['School'] = df['School'].str.strip().str.upper()\ndf['Score_raw'] = df['Score'].copy()\ndf['Score'] = pd.to_numeric(df['Score_raw'], errors='coerce')\ndf['Score_status'] = 'observed'\ndf.loc[df['Score_raw'].isna(), 'Score_status'] = 'unknown'\ndf.loc[df['Score_raw'].eq('缺考'), 'Score_status'] = 'absent'\ndf.loc[df['Score'].isna() & df['Score_raw'].notna() & ~df['Score_raw'].eq('缺考'), 'Score_status'] = 'parse_error'\nmeans = df.groupby('School')['Score'].mean().sort_values(ascending=False)\nprint(f'{means.index[0]} {means.iloc[0]:.2f}')\n```\n\n结果 SJTU 83.67。将所有转换后空分数填 0 时，SJTU 为 62.75，但 XJTLU 为 74.22、HIT 为 79.25，最高会变成 HIT。结论取决于完整处理口径。缺考、原始空值和解析失败应保留原值与状态，不能盲目填零或均值。",
    "SJTU 83.67"),

  q("py-mcm-11", "Day 12：多指标汇总并导出", 3,
    "## Day 12：多指标汇总并导出\n\n" +
    "前 10 题都在「看数据」，这一题开始「产出结果」——美赛论文里的每张汇总表都是这么做出来的。\n\n" +
    "**任务**：\n" +
    "1. 读入 `" + L1 + "`，去掉列名首尾空格\n" +
    "2. `School` 统一为去空格 + 全大写\n" +
    "3. `Score` 用 `pd.to_numeric(..., errors='coerce')` 转数值\n" +
    "4. **去掉完全重复的行**（`drop_duplicates()`）\n" +
    "5. 按 `School` 分组，算出平均分 `avg`（保留 2 位小数）和样本数 `n`\n" +
    "6. 导出到当前目录的 `school_summary.csv`，列名严格为 `school,avg,n`（小写）\n" +
    "7. **不要 print**——这题只检查产物文件\n\n" +
    "**验收**：`school_summary.csv` 恰好 4 行数据，列名 `school,avg,n`，数值允许 0.01 误差。\n\n" +
    "> 顺序很重要：这题要求「先转数值、再去重」，反过来做结果可能不同。",
    "import pandas as pd\n\n" +
    "df = pd.read_csv(\"" + L1 + "\")\n" +
    "df.columns = df.columns.str.strip()\n" +
    "df[\"School\"] = df[\"School\"].str.strip().str.upper()\n" +
    "df[\"Score\"] = pd.to_numeric(df[\"Score\"], errors=\"coerce\")\n" +
    "df = df.drop_duplicates()\n\n" +
    "# 1. 按 School 分组，一次算出 avg（2 位小数）和 n\n" +
    "\n" +
    "# 2. 把列名改成小写 school / avg / n\n" +
    "\n" +
    "# 3. 导出到 school_summary.csv（index=False，encoding=\"utf-8-sig\"）\n" +
    "\n" +
    "# 4. 不用 print\n",
    [
      "df.groupby('School')['Score'].agg(avg='mean', n='count') 一次拿到两个指标",
      "reset_index() 把 School 从索引变回普通列，然后 .columns = ['school','avg','n'] 改名",
      "to_csv('school_summary.csv', index=False, encoding='utf-8-sig')；小数位用 round(2)",
    ],
    "## 题解\n\n```python\n" +
    "import pandas as pd\n\n" +
    "df = pd.read_csv(\"" + L1 + "\")\n" +
    "df.columns = df.columns.str.strip()\n" +
    "df[\"School\"] = df[\"School\"].str.strip().str.upper()\n" +
    "df[\"Score\"] = pd.to_numeric(df[\"Score\"], errors=\"coerce\")\n" +
    "df = df.drop_duplicates()\n\n" +
    "summary = df.groupby(\"School\")[\"Score\"].agg(avg=\"mean\", n=\"count\").reset_index()\n" +
    "summary.columns = [\"school\", \"avg\", \"n\"]\n" +
    "summary[\"avg\"] = summary[\"avg\"].round(2)\n" +
    "summary.to_csv(\"school_summary.csv\", index=False, encoding=\"utf-8-sig\")\n" +
    "```\n\n" +
    "结果是 4 行：HIT 79.25 / 4、NUAA 78.33 / 3、SJTU 83.67 / 3、XJTLU 82.29 / 7。\n\n" +
    "**`n` 是 `count()`（非空计数），不是行数**：XJTLU 去重后有 8 行，但只有 7 个有效分数。\n\n" +
    "**美赛视角**：论文里的「各校平均分与样本量」表就是这张。样本量必须一起给出，否则「1 个样本考了 90 分」会被当成强证据。",
    "",
    {
      expect_csv: {
        path: "school_summary.csv",
        columns: ["school", "avg", "n"],
        rows: [
          { school: "HIT", avg: 79.25, n: 4 },
          { school: "NUAA", avg: 78.33, n: 3 },
          { school: "SJTU", avg: 83.67, n: 3 },
          { school: "XJTLU", avg: 82.29, n: 7 },
        ],
        key_columns: ["school"],
        abs_tol: 0.01,
        rel_tol: 0,
      },
      // 变体：换一套小数据（用同名路径覆盖），学生代码不用改，
      // 验证的是「会不会算」而不是「背没背答案」。
      variant_cases: [
        {
          stdin: "",
          expected_stdout: "",
          timeout_ms: 20000,
          match_mode: "contains",
          input_assets: [
            {
              path: "mcm/pandas_kit/data/level1_contest_raw.csv",
              content:
                "Team ID, School ,Year,Score,Members\n" +
                "V01, Alpha ,2025,80,3\n" +
                "V02,ALPHA,2026,90,3\n" +
                "V03,beta ,2025,70,3\n" +
                "V04,BETA,2026,缺考,3\n" +
                "V05,Alpha,2026,,2\n",
            },
          ],
          expect_csv: {
            path: "school_summary.csv",
            columns: ["school", "avg", "n"],
            rows: [
              { school: "ALPHA", avg: 85.0, n: 2 },
              { school: "BETA", avg: 70.0, n: 1 },
            ],
            key_columns: ["school"],
            abs_tol: 0.01,
            rel_tol: 0,
          },
        },
      ],
    }),
];

function exportQuestions(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const question of questions) {
    fs.writeFileSync(path.join(targetDir, question.id + ".json"), JSON.stringify(question, null, 2) + "\n");
  }
  console.log("pandas 题库生成:", questions.length, "道，目录:", targetDir);
}

if (require.main === module) {
  const targetDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(PROJ, "workspace-template", "bank");
  const allowedRoot = path.join(PROJ, "workspace-template");
  const relative = path.relative(allowedRoot, targetDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("CLI 输出目录必须位于项目 workspace-template 下");
  }
  exportQuestions(targetDir);
}

module.exports = { questions };
