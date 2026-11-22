// SQL 题库：6 道（内嵌 SQLite 判题，零外部依赖）
const fs = require("fs");
const path = require("path");

const SETUP = `CREATE TABLE teams(team_id TEXT, school TEXT, year INTEGER, members INTEGER);
CREATE TABLE scores(team_id TEXT, year INTEGER, score REAL);
INSERT INTO teams VALUES
('T01','XJTLU',2024,3),('T02','XJTLU',2025,3),('T03','NUAA',2024,2),
('T04','HIT',2025,3),('T05','SJTU',2026,2),('T06','XJTLU',2026,1),('T07','HIT',2026,3),('T08','NUAA',2026,2);
INSERT INTO scores VALUES
('T01',2024,88),('T02',2025,76),('T03',2024,91),('T04',2025,85),
('T05',2026,74),('T06',2026,95),('T07',2026,81),('T08',2026,77);`;

function q(id, title, diff, stmt, starter, hints, editorial, expected) {
  return {
    id, lang: "sql", title, difficulty: diff,
    tags: ["SQL", "数据库"],
    statement_md: stmt,
    starter_code: starter,
    hints,
    editorial_md: editorial,
    test_cases: [{ stdin: "", expected_stdout: expected, timeout_ms: 5000, setup_sql: SETUP }],
  };
}

const SCHEMA_DOC = "\n\n**本题已为你准备好两张表**（判题时自动建库）：\n- `teams(team_id, school, year, members)`：8 支队伍\n- `scores(team_id, year, score)`：8 条成绩\n\n你的 SQL 会在同一个 SQLite 内存库里执行，输出结果集与标准答案比对。\n";

const questions = [
  q("sql-01", "SQL 01：把整张表查出来", 1,
    "## SQL 01：把整张表查出来\n\n**任务**：用一条 SELECT 查询，取出 `teams` 表的**全部列、全部行**。\n\n**验收**：返回 8 行，包含全部队伍。" + SCHEMA_DOC,
    "-- 取出 teams 表的全部列和全部行\n-- 提示：SELECT ... FROM ...\n",
    ["SELECT * 表示所有列", "FROM teams 指定表名"],
    "## 题解\n\n```sql\nSELECT * FROM teams;\n```\n\n`*` 是通配符，代表所有列。",
    "team_id | school | year | members\nT01 | XJTLU | 2024 | 3\nT02 | XJTLU | 2025 | 3\nT03 | NUAA | 2024 | 2\nT04 | HIT | 2025 | 3\nT05 | SJTU | 2026 | 2\nT06 | XJTLU | 2026 | 1\nT07 | HIT | 2026 | 3\nT08 | NUAA | 2026 | 2"),

  q("sql-02", "SQL 02：只查 2026 年的队伍", 1,
    "## SQL 02：只查 2026 年的队伍\n\n**任务**：查询 `teams` 表中 **year = 2026** 的所有队伍（全部列）。\n\n**验收**：返回 4 行（T05、T06、T07、T08）。" + SCHEMA_DOC,
    "-- 查询 teams 表中 year = 2026 的全部队伍\n",
    ["WHERE 用来筛选行", "年份是整数，不用引号：WHERE year = 2026"],
    "## 题解\n\n```sql\nSELECT * FROM teams WHERE year = 2026;\n```",
    "team_id | school | year | members\nT05 | SJTU | 2026 | 2\nT06 | XJTLU | 2026 | 1\nT07 | HIT | 2026 | 3\nT08 | NUAA | 2026 | 2"),

  q("sql-03", "SQL 03：分数最高的前三名", 2,
    "## SQL 03：分数最高的前三名\n\n**任务**：从 `scores` 表查出**分数最高的 3 条成绩**，按分数从高到低排列，输出全部列。\n\n**验收**：T06(95)、T03(91)、T01(88) 三行，顺序不能错。" + SCHEMA_DOC,
    "-- 查 scores 表中分数最高的 3 条，按分数降序\n",
    ["ORDER BY score DESC 按分数降序", "LIMIT 3 只取前 3 行"],
    "## 题解\n\n```sql\nSELECT * FROM scores ORDER BY score DESC LIMIT 3;\n```",
    "team_id | year | score\nT06 | 2026 | 95\nT03 | 2024 | 91\nT01 | 2024 | 88"),

  q("sql-04", "SQL 04：每个学校有几支队伍", 2,
    "## SQL 04：每个学校有几支队伍\n\n**任务**：按学校分组，统计每个学校的队伍数量，输出 `school` 和 `cnt`（数量）两列，**按学校名升序**。\n\n**验收**：HIT 2、NUAA 2、SJTU 1、XJTLU 3。" + SCHEMA_DOC,
    "-- 按学校分组统计队伍数，输出 school 和 cnt，按学校名升序\n",
    ["GROUP BY school 把同校的行合并成一组", "COUNT(*) 统计每组行数，AS cnt 给列起别名"],
    "## 题解\n\n```sql\nSELECT school, COUNT(*) AS cnt FROM teams GROUP BY school ORDER BY school;\n```",
    "school | cnt\nHIT | 2\nNUAA | 2\nSJTU | 1\nXJTLU | 3"),

  q("sql-05", "SQL 05：把两张表连起来", 3,
    "## SQL 05：把两张表连起来\n\n**任务**：用 JOIN 把 `teams` 和 `scores` 按 `team_id` 连起来，输出 `team_id`、`school`、`score` 三列，**按 team_id 升序**。\n\n**验收**：8 行，每行是 队伍-学校-分数。" + SCHEMA_DOC,
    "-- teams 和 scores 按 team_id 连接，输出 team_id, school, score，按 team_id 升序\n",
    ["JOIN scores ON teams.team_id = scores.team_id", "SELECT teams.team_id, school, score 避免列名歧义"],
    "## 题解\n\n```sql\nSELECT teams.team_id, school, score\nFROM teams JOIN scores ON teams.team_id = scores.team_id\nORDER BY teams.team_id;\n```",
    "team_id | school | score\nT01 | XJTLU | 88\nT02 | XJTLU | 76\nT03 | NUAA | 91\nT04 | HIT | 85\nT05 | SJTU | 74\nT06 | XJTLU | 95\nT07 | HIT | 81\nT08 | NUAA | 77"),

  q("sql-06", "SQL 06：哪所学校平均分最高", 3,
    "## SQL 06：哪所学校平均分最高\n\n**任务**：连接两表后按学校分组，计算每个学校的**平均分**（保留 2 位小数），输出 `school` 和 `avg_score`，**只保留平均分最高的那一所**。\n\n**验收**：XJTLU 86.33（(88+76+95)/3）。" + SCHEMA_DOC,
    "-- 连接两表，按学校分组求平均分（2 位小数），只输出最高的一所\n",
    ["ROUND(AVG(score), 2) 求平均并保留两位小数", "ORDER BY avg_score DESC LIMIT 1 取最高"],
    "## 题解\n\n```sql\nSELECT school, ROUND(AVG(score), 2) AS avg_score\nFROM teams JOIN scores ON teams.team_id = scores.team_id\nGROUP BY school\nORDER BY avg_score DESC\nLIMIT 1;\n```",
    "school | avg_score\nXJTLU | 86.33"),
];

const targets = [
  process.env.LEARN_WORKSPACE ? process.env.LEARN_WORKSPACE + "/bank" : require("path").join(require("os").homedir(), "learn-workspace", "bank"),
  __dirname + "/portable/workspace/bank",
];
for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  for (const q of questions) fs.writeFileSync(path.join(dir, q.id + ".json"), JSON.stringify(q, null, 2) + "\n");
}
console.log("SQL 题库生成:", questions.length, "道");
