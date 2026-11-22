# matplotlib 闭卷验收参考答案（已运行验证）
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

OUT = Path("figures/exam")
OUT.mkdir(parents=True, exist_ok=True)
trend = pd.read_csv("data/exam_trend.csv")
points = pd.read_csv("data/exam_points.csv")


def save(fig, name, pdf=False):
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.png", dpi=300, bbox_inches="tight")
    if pdf:
        fig.savefig(OUT / f"{name}.pdf", bbox_inches="tight")
    plt.close(fig)
    print("saved", name)


# 1. 折线：年份是有顺序的连续维度，折线用于强调变化趋势
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(trend["year"], trend["pass_rate"], marker="o", label="Pass rate")
ax.set_title("Pass rate by year")
ax.set_xlabel("Year")
ax.set_ylabel("Pass rate (%)")
ax.set_xticks(trend["year"])
ax.set_ylim(0, 100)
ax.legend()
save(fig, "exam_line", pdf=True)

# 2. 柱状：比较三个离散年份的队伍数量
fig, ax = plt.subplots(figsize=(7, 4))
bars = ax.bar(trend["year"].astype(str), trend["teams"], label="Teams")
ax.set_title("Number of teams by year")
ax.set_xlabel("Year")
ax.set_ylabel("Number of teams")
ax.bar_label(bars, fmt="%.0f")
ax.set_ylim(0, 8)
ax.legend()
save(fig, "exam_bar")

# 3. 散点：观察两个数值变量的关系，不据此断言因果
fig, ax = plt.subplots(figsize=(7, 4))
ax.scatter(points["hours"], points["score"], label="Teams")
top = points.loc[points["score"].idxmax()]
ax.annotate(
    f"Highest: {top['team']} ({top['score']} points)",
    xy=(top["hours"], top["score"]), xytext=(7, 88),
    arrowprops={"arrowstyle": "->"}
)
ax.axhline(80, linestyle="--", color="gray", linewidth=1, label="80-point reference")
ax.set_title("Score versus preparation hours")
ax.set_xlabel("Preparation hours (h)")
ax.set_ylabel("Score (points)")
ax.set_ylim(0, 100)
ax.legend()
save(fig, "exam_scatter")

# 4. 双轴：颜色、单位、图例同时区分两种量纲，避免误读
fig, ax1 = plt.subplots(figsize=(7, 4))
ax1.plot(trend["year"], trend["pass_rate"], color="tab:blue", marker="o", label="Pass rate")
ax1.set_xlabel("Year")
ax1.set_ylabel("Pass rate (%)", color="tab:blue")
ax1.tick_params(axis="y", labelcolor="tab:blue")
ax1.set_xticks(trend["year"])
ax1.set_ylim(0, 100)
ax2 = ax1.twinx()
ax2.bar(trend["year"], trend["teams"], color="tab:orange", alpha=0.35, label="Teams")
ax2.set_ylabel("Number of teams", color="tab:orange")
ax2.tick_params(axis="y", labelcolor="tab:orange")
ax2.set_ylim(0, 8)
h1, l1 = ax1.get_legend_handles_labels()
h2, l2 = ax2.get_legend_handles_labels()
ax1.legend(h1 + h2, l1 + l2, loc="best")
ax1.set_title("Pass rate and team count by year")
save(fig, "exam_twinx")

# 英文分析示例：
# The pass rate increased from 72.5% in 2023 to 78.0% in 2024, then decreased
# to 75.5% in 2025. With only three years and 4–6 teams per year, this should
# be interpreted as descriptive variation rather than a stable trend.
#
# Scores tend to increase with preparation hours in these ten teams, with the
# highest score of 90 occurring at 14 hours. This association does not show
# that additional hours caused the higher scores.
