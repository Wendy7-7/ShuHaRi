# LaTeX / Overleaf：美赛论文排版速成

> 课程地图第 3 阶段。LaTeX 本地编译工具链体积大（>500MB），本软件不内置判题；
> 推荐用 **Overleaf**（在线，免费额度够用）直接套 MCM 模板。

## 30 分钟跑通第一篇

1. **注册 Overleaf** → New Project → Templates → 搜 "MCM" 官方模板（竞赛官网每年提供）
2. **主结构**（模板已给，认识即可）：
   ```latex
   \documentclass[12pt]{article}
   \usepackage{graphicx}   % 插图
   \usepackage{amsmath}    % 公式
   \usepackage{booktabs}   % 三线表
   \begin{document}
   \maketitle
   \section{Introduction}
   ...
   \end{document}
   ```

## 插图（接 matplotlib 模块）

- matplotlib 保存为 **PDF 格式**（矢量，缩放不糊）：`plt.savefig("figures/year_line.pdf")`
- LaTeX 引用：`\includegraphics[width=0.8\textwidth]{figures/year_line.pdf}`
- 图题：`\begin{figure}[htbp] ... \caption{Average score by year} \label{fig:year} \end{figure}`
- 正文引用：`as shown in Figure~\ref{fig:year}`

## 插表（三线表，美赛标准）

```latex
\begin{table}[htbp]
  \centering
  \begin{tabular}{lrr}
    \toprule
    School & Average & Teams \\
    \midrule
    XJTLU & 81.86 & 7 \\
    NUAA  & 71.75 & 4 \\
    \bottomrule
  \end{tabular}
  \caption{Summary by school}
\end{table}
```
pandas 导出：`df.to_latex()` 直接生成（记住这个，省一半时间）。

## 公式编号与引用

```latex
\begin{equation}
  \frac{dy}{dt} = -ky
  \label{eq:decay}
\end{equation}
正文引用：Equation~\eqref{eq:decay} shows the decay process.
```

## 参考文献

```latex
\begin{thebibliography}{9}
\bibitem{mcm2026} MCM Contest Rules, 2026.
\end{thebibliography}
```

## 摘要（决定奖项的一半）

MCM 摘要写法（120 词内英文）：
1. 一句话说清问题背景
2. 说出你的模型和方法（数学名词要出现）
3. 给出**具体数字结果**（评委会核对数字是否与正文一致）
4. 一句话说模型弱点/敏感性

## 检查清单（提交前）

- [ ] 所有图都是 PDF 矢量格式
- [ ] 公式有编号、正文有引用
- [ ] 摘要里有具体数字
- [ ] 团队控制号出现在每页页眉（模板自动）
- [ ] 不超过 25 页（MCM 新规）
