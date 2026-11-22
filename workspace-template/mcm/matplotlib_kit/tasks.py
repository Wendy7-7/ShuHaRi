# matplotlib 五天任务单
# 在 matplotlib_kit 目录下练习；先自己写，answers.py 只用于对照。
# 所有图保存到 figures/，不要截图。

# Day 1：折线与柱状
# 1. year_trend.csv -> year_line.png：平均分折线，圆点、标题、轴单位、年份刻度、0-100
# 2. school_summary.csv -> school_bar.png：平均分降序柱状，柱顶两位小数
# 3. 给柱状图 X 轴标签加入样本量，例如 XJTLU (n=7)
# 过关：能解释为什么一题用折线、一题用柱状

# Day 2：散点与双轴
# 4. score_hours.csv -> hours_scatter.png：学习时长 vs 得分
# 5. 按 college 分色，每组一个图例
# 6. year_trend.csv -> year_twinx.png：左轴平均分折线，右轴队伍数柱子
# 7. 合并两个轴的图例，给左右轴使用对应颜色
# 过关：能解释散点图为何不能证明因果，以及双轴的风险

# Day 3：标注与论文规范
# 8. team_scores.csv -> annotated_scores.png：散点并标出最高分 T13/2026/95
# 9. 加 80 分水平虚线，参考线也进图例
# 10. 给任一图写两句英文图后分析，含数字与样本局限
# 过关：六项清单全部满足

# Day 4：一键复现
# 11. 将上述图写成函数，统一 PNG + PDF 输出
# 12. 删除 figures 后，一条命令全部重建
# 13. 用 Pillow 检查至少一张 PNG 的 dpi
# 过关：没有手工复制粘贴、没有缺失 figures 目录就报错

# Day 5：开放任务与闭卷验收
# 14. 完成 开放任务.md：自己选图并说明为什么
# 15. 用 exam.py 在 45 分钟内完成闭卷验收
