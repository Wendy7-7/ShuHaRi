# 第 3 周参考答案（已运行验证）
import pandas as pd

scores = pd.read_csv("data/level2_scores_raw.csv")
teams = pd.read_csv("data/level2_teams_raw.csv")
for d in (scores, teams):
    d["team_id"] = d["team_id"].str.strip().str.upper()
teams = teams.drop_duplicates(subset="team_id")
merged = scores.merge(teams, on="team_id", how="left", validate="many_to_one")
print("merged:", merged.shape, "缺失总数:", merged.isna().sum().sum())

# ---------- Day 11 ----------
print("\n按学校平均分:\n", merged.groupby("school")["score"].mean())
print("\n按学校队伍数:\n", merged.groupby("school")["score"].count())
print("\n按题型平均分:\n", merged.groupby("problem")["score"].mean())
print("\n按学校排序:\n",
      merged.groupby("school")["score"].mean().sort_values(ascending=False))

# ---------- Day 12 ----------
by_school = (
    merged.groupby("school")["score"]
    .agg(avg="mean", top="max", n="count")
    .reset_index()
)
by_school["avg"] = by_school["avg"].round(2)
print("\n学校汇总表:\n", by_school)
by_school.to_csv("data/summary_by_school.csv", index=False, encoding="utf-8-sig")
# agg 等号左边是新列名，右边是计算方法

# ---------- Day 13 ----------
print("\n年份+学校:\n", merged.groupby(["year", "school"])["score"].mean().round(2))

t = merged.groupby("problem")["score"].count()
pct = (t / t.sum() * 100).round(1)
print("\n题型占比:\n", pd.DataFrame({"teams": t, "pct": pct}))

top_major = merged.groupby("major")["score"].mean().sort_values(ascending=False).head(5)
print("\n前 5 专业:\n", top_major.round(2))

best = merged.loc[merged.groupby("year")["score"].idxmax(), ["year", "team_id", "score"]]
print("\n每年最高分队伍:\n", best)
# 结论示例：C 题是最主流的选择，占全部参赛记录的 62.5%。
# 结论示例：金融数学专业平均得分最高（92.00 分），但样本仅 1 支队伍，结论需谨慎。
