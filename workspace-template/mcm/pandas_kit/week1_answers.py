# 第 1 周参考答案（已运行验证）
import pandas as pd

# ---------- Day 1 ----------
print("pandas 版本:", pd.__version__)
df = pd.read_csv("data/level1_contest_raw.csv")
print("Day1 行列数:", df.shape)
print(df.head())

# ---------- Day 2 ----------
print("\n列名:", list(df.columns))
print("\n类型:\n", df.dtypes)          # Score 是 str/object，因为混了"缺考"
print("\ninfo:")
df.info()
print("\n每列缺失:\n", df.isna().sum())   # Year 1、Score 2、Members 1
print("\ndescribe:\n", df.describe())     # 只对数值列生效，Score 被排除

# ---------- Day 3 ----------
print("\n完全重复行数:", df.duplicated().sum())   # 1
print("重复的行:\n", df[df.duplicated(keep=False)])
print("\nSchool 的所有写法:", df[" School "].unique())
print("\nSchool 计数:\n", df[" School "].value_counts())
# 结论：直接分组会把 XJTLU 拆成三个"学校"，均值和计数全错

# ---------- Day 4 ----------
print("\nScore 原始取值:", df["Score"].tolist())   # 含 "缺考" 和空
print("Year 缺失行数:", df["Year"].isna().sum())
print("Members 缺失行数:", df["Members"].isna().sum())
print("Team ID 重复:\n", df[df.duplicated(subset="Team ID", keep=False)])
# Team ID 重复的那条正是 Day3 的完全重复行（T09），属于录入重复

# 这份数据的问题清单（至少 5 条）：
# 1. 列名 " School " 两端有空格，直接用 "School" 取列会 KeyError
# 2. School 同校有四种写法：XJTLU / xjtlu␣ / ␣XJTLU / xjtlu（大小写与空格差异）
# 3. Score 列混入文本"缺考"，导致整列被读成文本，无法直接求均值
# 4. Score 有 2 行空值（T03、T16）
# 5. Year 有 1 行缺失（T10）
# 6. Members 有 1 行缺失（T08）
# 7. 存在 1 行完全重复（T09），属于重复录入

# ---------- Day 5 ----------
for path in ["data/level2_scores_raw.csv", "data/level2_teams_raw.csv"]:
    d = pd.read_csv(path)
    print("\n=====", path, "=====")
    print("行列数:", d.shape)
    print("缺失:\n", d.isna().sum())
    print("完全重复行:", d.duplicated().sum())
    print("team_id 写法:", d["team_id"].unique())
    print("team_id 重复键:", d.duplicated(subset="team_id").sum())
# scores：team_id 有大小写和空格不一致（t02、T03␣、t09），无缺失
# teams：有 1 个重复键 T16，直接 merge 会导致行数变多
