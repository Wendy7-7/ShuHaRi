# matplotlib 参考答案（已运行验证）
# 在 matplotlib_kit 目录下运行：python answers.py
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

OUT = Path("figures")
OUT.mkdir(exist_ok=True)


def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.png", dpi=300, bbox_inches="tight")
    fig.savefig(OUT / f"{name}.pdf", bbox_inches="tight")
    plt.close(fig)
    print(f"saved: {name}.png / {name}.pdf")


def year_line():
    df = pd.read_csv("data/year_trend.csv")
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(df["year"], df["avg_score"], marker="o", label="Average score")
    ax.set_title("Average score by year")
    ax.set_xlabel("Year")
    ax.set_ylabel("Average score (points)")
    ax.set_xticks(df["year"])
    ax.set_ylim(0, 100)
    ax.grid(axis="y", alpha=0.2)
    ax.legend()
    save(fig, "year_line")


def school_bar():
    df = pd.read_csv("data/school_summary.csv").sort_values("avg_score", ascending=False)
    labels = df["school"] + " (n=" + df["teams"].astype(str) + ")"
    fig, ax = plt.subplots(figsize=(7, 4))
    bars = ax.bar(labels, df["avg_score"], label="Average score")
    ax.set_title("Average score by school")
    ax.set_xlabel("School")
    ax.set_ylabel("Average score (points)")
    ax.set_ylim(0, 100)
    ax.bar_label(bars, fmt="%.2f")
    ax.legend()
    save(fig, "school_bar")


def hours_scatter():
    df = pd.read_csv("data/score_hours.csv")
    colors = {"IME": "tab:blue", "SAT": "tab:orange", "BUS": "tab:green"}
    fig, ax = plt.subplots(figsize=(7, 4))
    for college, group in df.groupby("college"):
        ax.scatter(group["hours"], group["score"], label=college, color=colors[college])
    top = df.loc[df["score"].idxmax()]
    ax.annotate(
        f"Highest: {top['team']} ({top['score']:.0f})",
        xy=(top["hours"], top["score"]), xytext=(10, 94),
        arrowprops={"arrowstyle": "->"}
    )
    ax.axhline(80, linestyle="--", linewidth=1, color="gray", label="80-point reference")
    ax.set_title("Score versus preparation hours")
    ax.set_xlabel("Preparation hours (h)")
    ax.set_ylabel("Score (points)")
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 100)
    ax.legend()
    save(fig, "hours_scatter")


def year_twinx():
    df = pd.read_csv("data/year_trend.csv")
    fig, ax1 = plt.subplots(figsize=(7, 4))
    ax1.plot(df["year"], df["avg_score"], color="tab:blue", marker="o", label="Average score")
    ax1.set_xlabel("Year")
    ax1.set_ylabel("Average score (points)", color="tab:blue")
    ax1.tick_params(axis="y", labelcolor="tab:blue")
    ax1.set_xticks(df["year"])
    ax1.set_ylim(0, 100)

    ax2 = ax1.twinx()
    ax2.bar(df["year"], df["teams"], color="tab:orange", alpha=0.35, label="Teams")
    ax2.set_ylabel("Number of teams", color="tab:orange")
    ax2.tick_params(axis="y", labelcolor="tab:orange")
    ax2.set_ylim(0, 8)

    handles1, labels1 = ax1.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(handles1 + handles2, labels1 + labels2, loc="best")
    ax1.set_title("Average score and team count by year")
    save(fig, "year_twinx")


def annotated_scores():
    df = pd.read_csv("data/team_scores.csv")
    top = df.loc[df["score"].idxmax()]
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.scatter(df["year"], df["score"], label="Teams")
    ax.annotate(
        f"Highest: {top['team_id']} ({top['score']} points)",
        xy=(top["year"], top["score"]), xytext=(2024.3, 93),
        arrowprops={"arrowstyle": "->"}
    )
    ax.axhline(80, linestyle="--", linewidth=1, color="gray", label="80-point reference")
    ax.set_title("Team scores by year")
    ax.set_xlabel("Year")
    ax.set_ylabel("Score (points)")
    ax.set_xticks(sorted(df["year"].unique()))
    ax.set_ylim(0, 100)
    ax.legend()
    save(fig, "annotated_scores")


if __name__ == "__main__":
    year_line()
    school_bar()
    hours_scatter()
    year_twinx()
    annotated_scores()
    print("全部完成")
