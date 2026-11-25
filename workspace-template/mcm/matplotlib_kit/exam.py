# matplotlib 闭卷验收（45 分钟）
# 不看教程、速查表、answers.py；允许看报错和自己打印的数据。
# 在 matplotlib_kit 目录下完成，所有图片保存到 figures/exam/。

# 数据 A：mcm/matplotlib_kit/data/exam_trend.csv（year, pass_rate, teams）
# 数据 B：mcm/matplotlib_kit/data/exam_points.csv（team, hours, score）

# 任务 1：折线图 exam_line.png
# 画历年 pass_rate，标题、Year、Pass rate (%)、圆点、正确年份刻度。

# 任务 2：柱状图 exam_bar.png
# 画各年 teams，按年份排列，柱顶显示整数，Y 轴为 Number of teams。

# 任务 3：散点图 exam_scatter.png
# hours 为 X 轴、score 为 Y 轴，标出最高分 E09（14 小时，90 分）。
# 加 80 分参考线并进图例。

# 任务 4：双 Y 轴 exam_twinx.png
# 左轴 pass_rate 折线（%），右轴 teams 柱子（队），合并图例并区分颜色。

# 任务 5：保存与复现
# 四张图均为 300 dpi PNG，且至少一张同时输出 PDF。
# 所有图由一个脚本一次运行生成，figures/exam 目录不存在时自动创建。

# 任务 6：写两句英文图后分析
# 一句关于历年通过率，一句关于学习时长与得分；
# 必须包含数字，并说明小样本或相关不等于因果的限制。

# 口头追问
# Q1：第 1 题为什么用折线而不是散点？
# Q2：双 Y 轴为什么可能误导？你做了什么降低误导？
# Q3：为什么散点图不能证明学习时长导致高分？
# Q4：dpi=300 和 bbox_inches="tight" 分别解决什么？
