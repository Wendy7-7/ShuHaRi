# 第 8 课：分组汇总 groupby（对应 Day 11 - Day 13）

目标：把明细数据变成论文里的汇总表和结论。
**这是 pandas 里最有"分析感"的一步，也是 C 题的主力动作。**

先准备好合并后的数据（第 7 课的代码）：

```python
import pandas as pd

scores = pd.read_csv("mcm/pandas_kit/data/level2_scores_raw.csv")
teams = pd.read_csv("mcm/pandas_kit/data/level2_teams_raw.csv")
for d in (scores, teams):
    d["team_id"] = d["team_id"].str.strip().str.upper()
teams = teams.drop_duplicates()
if teams["team_id"].duplicated().any():
    raise ValueError("team_id 存在字段冲突，拒绝静默保留第一条")
merged = scores.merge(teams, on="team_id", how="left", validate="many_to_one")
```

---

## 8.1 一句话理解 groupby

> **按某列分组 → 每组取出一列 → 对每组算一个数。**

```python
merged.groupby("school")["score"].mean()
```

读作：按学校分组，取 score 列，每组求平均。

**输出：**

```
school
HIT      81.666667
NUAA     71.750000
SJTU     81.000000
XJTLU    81.857143
Name: score, dtype: float64
```

左边是组名（索引），右边是计算结果。

把 groupby 想成"**把一张表撕成几叠，每叠分别算，再合并结果**"。

---

## 8.2 最常用的几个计算

```python
merged.groupby("school")["score"].mean()    # 平均
merged.groupby("school")["score"].count()   # 有多少条
merged.groupby("school")["score"].max()     # 最高
merged.groupby("school")["score"].min()     # 最低
merged.groupby("school")["score"].sum()     # 总和
merged.groupby("school")["score"].std()     # 标准差（波动）
merged.groupby("school")["score"].median()  # 中位数
```

**`count` 和 `sum` 别搞混**：count 是"几条记录"，sum 是"加起来多少分"。

---

## 8.3 一次算多个指标：agg

```python
result = merged.groupby("school")["score"].agg(
    avg="mean",
    top="max",
    n="count"
)
print(result)
```

**输出：**

```
            avg   top  n
school
HIT     81.666667   85  3
NUAA    71.750000   91  4
SJTU    81.000000   88  2
XJTLU   81.857143   95  7
```

**等号左边是你给新列起的名字，右边是计算方法。** 名字随便起，看得懂就行。

---

## 8.4 reset_index：把组名变回普通列

```python
result = result.reset_index()
print(result)
```

```
  school       avg  top  n
0    HIT  81.666667   85  3
1   NUAA  71.750000   91  4
2   SJTU  81.000000   88  2
3  XJTLU  81.857143   95  7
```

**区别**：之前 school 是"索引"（左边那列加粗的），现在它是普通的一列。
后面要画图、要导出、要再筛选，都先 `reset_index()`。

保留两位小数：

```python
result["avg"] = result["avg"].round(2)
```

---

## 8.5 排序与取前几名

```python
result.sort_values("avg", ascending=False)
```

直接找"平均得分最高的 5 个专业"：

```python
top_major = (
    merged.groupby("major")["score"].mean()
    .sort_values(ascending=False)
    .head(5)
)
print(top_major.round(2))
```

**输出：**

```
major
Financial Mathematics                92.00
Applied Mathematics                  89.50
Information and Computing Science    86.33
Statistics                           85.00
Environmental Science                81.00
Name: score, dtype: float64
```

> **注意一个分析素养问题**：Financial Mathematics 只有 1 支队伍，平均分 92 就排第一了。
> 论文里必须补一句"该专业仅 1 支队伍，样本量不足以支撑结论"。
> **汇总数不配上样本量，就是在误导评委。**

---

## 8.6 多键分组

```python
merged.groupby(["year", "school"])["score"].mean()
```

按"年份 + 学校"两个维度分组，每年每个学校一行。

```python
merged.groupby(["year", "school"])["score"].mean().reset_index()
```

---

## 8.7 占比

```python
t = merged.groupby("problem")["score"].count()
print(t)
print((t / t.sum() * 100).round(1))
```

**输出：**

```
problem
A     3
B     1
C    10
F     2

A    18.8
B     6.2
C    62.5
F    12.5
```

**这就是论文里"62.5% 的队伍选择了 C 题"这句话的来源。**

整理成一张好看的表：

```python
summary = pd.DataFrame({"teams": t, "pct": (t / t.sum() * 100).round(1)})
print(summary)
```

---

## 8.8 每年最高分的队伍（稍进阶，但很常用）

```python
best = merged.loc[merged.groupby("year")["score"].idxmax(), ["year", "team_id", "score"]]
print(best)
```

**输出：**

```
    year team_id  score
3   2024     T04     91
8   2025     T09     92
12  2026     T13     95
```

`idxmax()` = "返回最大值所在的行号"，再用 `.loc` 把那些行取出来。
看不懂就先记住这个固定搭配，用三次就熟了。

---

## 8.9 本课练习

用 `merged` 完成：

1. 按 `region` 求平均得分和队伍数
2. 按 `problem` 求平均得分，按从高到低排序
3. 找出每个 `school` 得分最高的队伍（用 idxmax）
4. 算各 `major` 的队伍数，找出人最多的专业
5. 把第 1 问的结果导出为 `mcm/pandas_kit/data/by_region.csv`

---

## 本课验收

不看讲义，独立写出：

```python
# 按学校分组，算平均分和队伍数，按平均分降序，保留两位小数
```

并且能回答：**为什么报告平均分时必须同时报告队伍数？**
（因为 1 支队伍的"平均分"就是它自己的分数，没有统计意义。）
