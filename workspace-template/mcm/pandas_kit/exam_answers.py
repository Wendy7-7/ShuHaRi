# 可选综合练习参考答案（保留原值和缺失原因）
import pandas as pd

df = pd.read_csv("mcm/pandas_kit/data/exam_main.csv")
print("行列数:", df.shape)
print("列名:", list(df.columns))
print(df.dtypes)
print("缺失:\n", df.isna().sum())
print("重复行:", df.duplicated().sum())
print("College 写法:", df[" College "].unique())

df.columns = df.columns.str.strip()
df["College"] = df["College"].str.strip().str.upper()
df["Score_raw"] = df["Score"].copy()
df["Score"] = pd.to_numeric(df["Score_raw"], errors="coerce")
df["Score_status"] = "observed"
df.loc[df["Score_raw"].isna(), "Score_status"] = "unknown"
df.loc[df["Score_raw"].eq("未提交"), "Score_status"] = "absent"
df.loc[df["Score"].isna() & df["Score_raw"].notna() & ~df["Score_raw"].eq("未提交"), "Score_status"] = "parse_error"
print("\nScore 转换后缺失:", df["Score"].isna().sum())

before = len(df)
df = df.drop_duplicates()
print(f"去重: {before} -> {len(df)}")

# Year 仅 1 行缺失且无法推断，删行
df = df.dropna(subset=["Year"])
observed = df["Score"].where(df["Score_status"].eq("observed"))
year_means = observed.groupby(df["Year"]).transform("mean")
df["Score_analysis"] = df["Score"].copy()
unknown = df["Score_status"].eq("unknown")
df.loc[unknown, "Score_analysis"] = year_means.loc[unknown]
df["Score_imputed"] = unknown & df["Score_analysis"].notna()
# 仅为模拟练习假设：Hours 用中位数估计，不代表恢复了真实时长。
df["Hours"] = df["Hours"].fillna(df["Hours"].median())
print("Score 原值空缺:", df["Score_raw"].isna().sum())
print("Score 状态计数:\n", df["Score_status"].value_counts())
print("Score 估计数:", df["Score_imputed"].sum())
print("清洗后缺失总数（保留缺失原因，不要求为零）:", df.isna().sum().sum())

info = pd.read_csv("mcm/pandas_kit/data/exam_info.csv")
print("\ninfo 重复键:", info.duplicated(subset="team").sum())
info = info.drop_duplicates()
if info["team"].duplicated().any():
    raise ValueError("team 存在字段冲突，拒绝静默保留第一条")

merged = df.merge(info, left_on="Team", right_on="team", how="left", validate="one_to_one")
print(f"合并: {len(df)} -> {len(merged)}")
print("合并后缺失:\n", merged.isna().sum())

by_college = (
    merged.groupby("College").agg(avg=("Score", "mean"), n=("Score", "count"), teams=("Team", "size"))
    .sort_values("avg", ascending=False).round(2).reset_index()
)
print("\n按学院:\n", by_college)
print("\n年份+学院:\n", merged.groupby(["Year", "College"])["Score"].mean().round(2))

t = merged.groupby("campus")["Team"].count()
print("\n校区占比:\n", pd.DataFrame({"teams": t, "pct": (t / t.sum() * 100).round(1)}))

by_college.head(3).to_csv("mcm/pandas_kit/data/exam_summary.csv", index=False, encoding="utf-8-sig")

# 结论必须使用上面的真实输出，区分有效观测数与队伍数。
# 未提交保留缺失；unknown 仅可选估计到 Score_analysis，原 Score 不覆盖。
# left 保留主表记录，重复键冲突必须报告；该练习只检验本模块能力。
