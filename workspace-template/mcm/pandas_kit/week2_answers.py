# 第 2 周参考答案（已运行验证）
import pandas as pd

# ---------- Day 6 ----------
df = pd.read_csv("mcm/pandas_kit/data/level1_contest_raw.csv")
df.columns = df.columns.str.strip()
print("列名:", list(df.columns))
df["School"] = df["School"].str.strip().str.upper()
df["Team ID"] = df["Team ID"].str.strip().str.upper()
print("School 取值:", df["School"].unique())

# ---------- Day 7 ----------
print("\n转换前 Score 类型:", df["Score"].dtype)
df["Score_raw"] = df["Score"].copy()
df["Score"] = pd.to_numeric(df["Score_raw"], errors="coerce")
df["Score_status"] = "observed"
df.loc[df["Score_raw"].isna(), "Score_status"] = "unknown"
df.loc[df["Score_raw"].eq("缺考"), "Score_status"] = "absent"
df.loc[df["Score"].isna() & df["Score_raw"].notna() & ~df["Score_raw"].eq("缺考"), "Score_status"] = "parse_error"
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
# 模拟教学假设：仅 unknown 允许按同年原始观测均值估计；不覆盖缺考和解析失败。
observed = df["Score"].where(df["Score_status"].eq("observed"))
year_means = observed.groupby(df["Year"]).transform("mean")
df["Score_analysis"] = df["Score"].copy()
unknown = df["Score_status"].eq("unknown")
df.loc[unknown, "Score_analysis"] = year_means.loc[unknown]
df["Score_imputed"] = unknown & df["Score_analysis"].notna()
# Members 众数填补仅为模拟练习假设，不能从众数推出真实赛规
df["Members"] = df["Members"].fillna(df["Members"].mode()[0])
print("分析列缺失（缺考/解析失败保留）:\n", df[["Score", "Score_analysis"]].isna().sum())

# ---------- Day 9 ----------
print("\nScore>80:\n", df[df["Score"] > 80])
print("\n2026 XJTLU 高分:\n",
      df[(df["Year"] == 2026) & (df["School"] == "XJTLU") & (df["Score"] > 80)])
print("\n两所学校:\n", df[df["School"].isin(["XJTLU", "NUAA"])].shape)
print("\n只留三列:\n", df.loc[df["Score"] > 80, ["Team ID", "School", "Score"]].head())
df.to_csv("mcm/pandas_kit/data/level1_clean.csv", index=False, encoding="utf-8-sig")
check = pd.read_csv("mcm/pandas_kit/data/level1_clean.csv")
print("读回形状:", check.shape)
print("读回列名:", list(check.columns))
print("Score_status 读回计数:\n", check["Score_status"].value_counts())
print("Score_raw 读回缺失:", check["Score_raw"].isna().sum())
assert check.shape == df.shape
assert "Unnamed: 0" not in check.columns
assert {"Score_raw", "Score_status", "Score_analysis", "Score_imputed"}.issubset(check.columns)

# ---------- Day 10 ----------
scores = pd.read_csv("mcm/pandas_kit/data/level2_scores_raw.csv")
teams = pd.read_csv("mcm/pandas_kit/data/level2_teams_raw.csv")
for d in (scores, teams):
    d["team_id"] = d["team_id"].str.strip().str.upper()

print("\nteams 重复键数:", teams.duplicated(subset="team_id").sum())
teams_clean = teams.drop_duplicates()
if teams_clean["team_id"].duplicated().any():
    raise ValueError("team_id 存在字段冲突，拒绝静默保留第一条")

merged = scores.merge(teams_clean, on="team_id", how="left", validate="many_to_one")
print(f"合并: {len(scores)} -> {len(merged)}")
print("合并后缺失:\n", merged.isna().sum())
# 用 left 是因为要保留成绩表的全部记录，不让队伍信息缺失把成绩悄悄删掉

# 实验：不去重直接合并，行数会爆炸
bad = scores.merge(teams, on="team_id", how="left")
print(f"不去重直接合并: {len(scores)} -> {len(bad)}  (T16 的成绩被复制了两份)")
