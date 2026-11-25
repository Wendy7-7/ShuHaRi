# 第 9 课：串成 pipeline（对应 Day 14 - Day 15）

目标：把前八课写过的所有步骤，整理成**一个能一键运行的脚本**。
这是从"会写几行 pandas"到"能在比赛里干活"的分水岭。

---

## 9.1 为什么需要 pipeline

比赛中的真实情况：

- 第三天早上，队友说"我用错数据版本了，换这个新的"
- 你发现清洗规则要改一处，但后面十步都要重做
- 论文要附"数据处理方法"，你得说清楚每一步做了什么

**手工操作无法复现，脚本可以。** 改完点一次运行，30 秒全部重来。

---

## 9.2 一个合格的 pipeline 长什么样

新建 `pipeline.py`（套件里已附一份同名参考实现，**先自己写，跑不通再对照**）：

```python
import pandas as pd

# ========== 1. 读入 ==========
print("=" * 40)
print("STEP 1 读入原始数据")
scores = pd.read_csv("mcm/pandas_kit/data/level2_scores_raw.csv")
teams = pd.read_csv("mcm/pandas_kit/data/level2_teams_raw.csv")
print(f"scores: {scores.shape}, teams: {teams.shape}")

# ========== 2. 清洗键 ==========
print("=" * 40)
print("STEP 2 统一 team_id 写法")
for d in (scores, teams):
    d["team_id"] = d["team_id"].str.strip().str.upper()

# ========== 3. 去重 ==========
print("=" * 40)
print("STEP 3 去除重复键")
before = len(teams)
teams = teams.drop_duplicates()
if teams["team_id"].duplicated().any():
    raise ValueError("team_id 存在字段冲突，拒绝静默保留第一条")
print(f"teams: {before} -> {len(teams)}")

# ========== 4. 合并 ==========
print("=" * 40)
print("STEP 4 合并")
merged = scores.merge(teams, on="team_id", how="left", validate="many_to_one")
print(f"合并: {len(scores)} -> {len(merged)}")
print("未匹配数量:", merged["school"].isna().sum())

# ========== 5. 汇总 ==========
print("=" * 40)
print("STEP 5 汇总")
by_school = (
    merged.groupby("school")["score"]
    .agg(avg="mean", top="max", n="count")
    .sort_values("avg", ascending=False)
    .reset_index()
)
by_school["avg"] = by_school["avg"].round(2)
print(by_school)

t = merged.groupby("problem")["score"].count()
by_problem = pd.DataFrame({"teams": t, "pct": (t / t.sum() * 100).round(1)})
print(by_problem)

# ========== 6. 导出 ==========
print("=" * 40)
print("STEP 6 导出")
merged.to_csv("mcm/pandas_kit/data/merged_clean.csv", index=False, encoding="utf-8-sig")
by_school.to_csv("mcm/pandas_kit/data/summary_by_school.csv", index=False, encoding="utf-8-sig")
print("完成")
```

运行：

```bash
python mcm/pandas_kit/pipeline.py
```

**屏幕会按步骤打印，你能清楚看到每一步的行数变化。** 出问题一眼定位。

---

## 9.3 pipeline 的三条规矩

1. **每个步骤打印行数**——这是你的"是否出错"报警器
2. **每个关键决定写注释理由**——这些理由直接进论文
3. **不许有手工步骤**——所有修改都在代码里，不许"我先在 Excel 里删了一行"

---

## 9.4 验证它的可复现性（重要实验）

1. 把 `mcm/pandas_kit/data/merged_clean.csv` 和 `mcm/pandas_kit/data/summary_by_school.csv` 删掉
2. 再运行一次 `python mcm/pandas_kit/pipeline.py`
3. 文件应该重新出现，内容完全一样

再把输入文件名改成一个不存在的名字，运行一次，看看 `FileNotFoundError`，然后改回来。
**熟悉报错长什么样，比赛时才不会慌。**

---

## 9.5 期末三周的维持方案

不学新内容，每周 30 分钟：

- 第 1 次：运行一遍 `pipeline.py`，逐行读注释
- 第 2 次：合上代码，把 pipeline 重写一遍
- 第 3 次：换 `exam_main.csv` / `exam_info.csv` 重写一遍

目的只有一个：**别让手生回去。**

---

## 9.6 可选综合练习（1 月 4 日前）

`exam.py` 是可选综合练习，可限时 45 分钟挑战；允许查看速查表并修改任务。它只检验本模块数据处理能力，不代表完整美赛能力。

**过关标准**
1. 可在自己的时间约束内跑通，并解释行数变化
2. 每一步行数变化都能解释
3. 四个口头追问答得上来（见 exam.py 末尾）
4. 能写出一段英文的数据预处理说明

---

## 9.7 通过之后去哪

回到学习路径表的下一关：**matplotlib**。
到时候你会用到本课的 `by_school`、`by_problem` 这些汇总表——
**分组汇总的结果就是画图的输入**，这两关是连在一起的。

所以别把这些练习文件删了，第 2 关还要继续用。
