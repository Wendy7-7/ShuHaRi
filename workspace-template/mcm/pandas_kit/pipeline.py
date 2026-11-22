# 第 9 课配套：完整 pipeline（已运行验证）
# 用法：在 pandas_kit 目录下执行  python pipeline.py
# 练习时请先自己照着 手把手/09 写一遍，跑不通再对照本文件。
import pandas as pd

# ========== 1. 读入 ==========
print("=" * 40)
print("STEP 1 读入原始数据")
scores = pd.read_csv("data/level2_scores_raw.csv")
teams = pd.read_csv("data/level2_teams_raw.csv")
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
teams = teams.drop_duplicates(subset="team_id")
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
merged.to_csv("data/merged_clean.csv", index=False, encoding="utf-8-sig")
by_school.to_csv("data/summary_by_school.csv", index=False, encoding="utf-8-sig")
print("完成")
