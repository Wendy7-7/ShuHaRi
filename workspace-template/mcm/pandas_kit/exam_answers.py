# 闭卷验收参考答案（已运行验证）
import pandas as pd

df = pd.read_csv("data/exam_main.csv")
print("行列数:", df.shape)
print("列名:", list(df.columns))
print(df.dtypes)
print("缺失:\n", df.isna().sum())
print("重复行:", df.duplicated().sum())
print("College 写法:", df[" College "].unique())

df.columns = df.columns.str.strip()
df["College"] = df["College"].str.strip().str.upper()
df["Score"] = pd.to_numeric(df["Score"], errors="coerce")
print("\nScore 转换后缺失:", df["Score"].isna().sum())

before = len(df)
df = df.drop_duplicates()
print(f"去重: {before} -> {len(df)}")

# Year 仅 1 行缺失且无法推断，删行
df = df.dropna(subset=["Year"])
df["Score"] = df["Score"].fillna(df.groupby("Year")["Score"].transform("mean"))
df["Hours"] = df["Hours"].fillna(df["Hours"].median())
print("清洗后缺失总数:", df.isna().sum().sum())

info = pd.read_csv("data/exam_info.csv")
print("\ninfo 重复键:", info.duplicated(subset="team").sum())
info = info.drop_duplicates(subset="team")

merged = df.merge(info, left_on="Team", right_on="team", how="left", validate="one_to_one")
print(f"合并: {len(df)} -> {len(merged)}")
print("合并后缺失:\n", merged.isna().sum())

by_college = (
    merged.groupby("College")["Score"].agg(avg="mean", n="count")
    .sort_values("avg", ascending=False).round(2).reset_index()
)
print("\n按学院:\n", by_college)
print("\n年份+学院:\n", merged.groupby(["Year", "College"])["Score"].mean().round(2))

t = merged.groupby("campus")["Team"].count()
print("\n校区占比:\n", pd.DataFrame({"teams": t, "pct": (t / t.sum() * 100).round(1)}))

by_college.head(3).to_csv("data/exam_summary.csv", index=False, encoding="utf-8-sig")

# 结论示例（数字已与运行结果核对）：
# 1. SAT 平均得分 82.60 分居首（5 队），IME 81.75（8 队）、BUS 81.33（3 队），
#    三院差距不足 1.3 分，且样本量都很小，不宜据此断言学院间存在水平差异。
# 2. 原始 18 条记录中有 2 条标记为"未提交"（约 11%），按缺失处理并用当年均值填充。
# 3. 苏州与太仓校区各占 50%（各 8 队），样本在校区间分布均衡。

# 追问答法
# Q1 left 保留成绩表全部记录；inner 会丢掉信息表里没有的队伍（本题若无缺失则行数相同，但语义不同）
# Q2 未提交不等于 0 分，填 0 会拉低整体均值并扭曲分布
# Q3 只有 1 行且无法推断，删除比编造年份更诚实
# Q4 行数膨胀，同一支队伍的成绩被复制，后续均值和计数全部失真
