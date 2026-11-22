# 第 2 周参考答案（已运行验证）
import pandas as pd

# ---------- Day 6 ----------
df = pd.read_csv("data/level1_contest_raw.csv")
df.columns = df.columns.str.strip()
print("列名:", list(df.columns))
df["School"] = df["School"].str.strip().str.upper()
df["Team ID"] = df["Team ID"].str.strip().str.upper()
print("School 取值:", df["School"].unique())

# ---------- Day 7 ----------
print("\n转换前 Score 类型:", df["Score"].dtype)
df["Score"] = pd.to_numeric(df["Score"], errors="coerce")
df["Members"] = pd.to_numeric(df["Members"], errors="coerce")
print("转换后 Score 类型:", df["Score"].dtype)
print("转换后缺失:\n", df.isna().sum())
# 缺失变多的原因："缺考"无法转成数字，被 coerce 成 NaN

# ---------- Day 8 ----------
before = len(df)
df = df.drop_duplicates()
print(f"\n去重: {before} -> {len(df)}")

# Year 只有 1 行缺失，且无法从其他列推断，删行比编造年份更诚实
df = df.dropna(subset=["Year"])
# Score 用"同年份均值"填充：不同年份整体水平不同，全体均值会扭曲分布
df["Score"] = df["Score"].fillna(df.groupby("Year")["Score"].transform("mean"))
# Members 用众数：赛规即 3 人一队，众数就是 3，有业务依据
df["Members"] = df["Members"].fillna(df["Members"].mode()[0])
print("清洗后缺失:\n", df.isna().sum())

# ---------- Day 9 ----------
print("\nScore>80:\n", df[df["Score"] > 80])
print("\n2026 XJTLU 高分:\n",
      df[(df["Year"] == 2026) & (df["School"] == "XJTLU") & (df["Score"] > 80)])
print("\n两所学校:\n", df[df["School"].isin(["XJTLU", "NUAA"])].shape)
print("\n只留三列:\n", df.loc[df["Score"] > 80, ["Team ID", "School", "Score"]].head())
df.to_csv("data/level1_clean.csv", index=False, encoding="utf-8-sig")
print("导出后列名:", list(pd.read_csv("data/level1_clean.csv").columns))

# ---------- Day 10 ----------
scores = pd.read_csv("data/level2_scores_raw.csv")
teams = pd.read_csv("data/level2_teams_raw.csv")
for d in (scores, teams):
    d["team_id"] = d["team_id"].str.strip().str.upper()

print("\nteams 重复键数:", teams.duplicated(subset="team_id").sum())
teams_clean = teams.drop_duplicates(subset="team_id")

merged = scores.merge(teams_clean, on="team_id", how="left", validate="many_to_one")
print(f"合并: {len(scores)} -> {len(merged)}")
print("合并后缺失:\n", merged.isna().sum())
# 用 left 是因为要保留成绩表的全部记录，不让队伍信息缺失把成绩悄悄删掉

# 实验：不去重直接合并，行数会爆炸
bad = scores.merge(teams, on="team_id", how="left")
print(f"不去重直接合并: {len(scores)} -> {len(bad)}  (T16 的成绩被复制了两份)")
