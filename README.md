# ShuHaRi

> 守 · 破 · 离 —— starter 引导是「守」，变体重做是「破」，形成自己的写法是「离」。

**一个开源的本地编程练习框架**：Rust 判题引擎 + 语言包插件系统 + AI 教练接入层 + 完整的学习闭环。

默认附带 65 道入门题和一个数据科学入门模块——但这个项目真正的贡献不是题库，
是**框架**：判题沙盒、插件规范、学习闭环全是现成的，任何人都能往里装内容、
换内容，甚至 fork 出去做出属于自己的教学软件。

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Plugin Spec](https://img.shields.io/badge/插件规范-v1-blue)](PLUGIN_SPEC.md)

**[简体中文](README.md) | [English](README.en.md)**

---

## 现在有什么（如实版）

- **判题框架**：C/C++/Python/Java/Go/JavaScript 本地沙盒（超时/stdin 注入/输出规范化），
  SQL 内嵌 SQLite 零依赖，存图类任务可校验 PNG dpi
- **语言包插件系统**：每种语言一个 zip（工具链+题库+教程），装/卸/注册第三方判题执行器，
  主程序零改动接入（规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)）
- **学习闭环**：错题变体重做（防背答案）、知识点关卡解锁、错题本、考试模式、统计、徽章
- **AI 教练接入层**：自带 OpenAI 兼容 Key 即可启用，反问式提示词（先问思路再给提示，不给完整代码）
- **双语界面**：中文 / English
- **附带内容**：65 道入门题 + 数据科学入门模块（pandas 清洗、matplotlib 出图、scipy 统计基础）

## 还没有什么（同样如实）

- 题库只有 65 题——它**不是**刷题平台，题量靠社区一起堆
- 数据科学模块只是**入门子集**——不是数学建模的完整备考工具（后者需要真实赛题、论文训练和大量练习）
- AI 教练对话与题面暂为中文（英文界面可用，欢迎 PR 翻译）
- 无自动更新、无安装器（解压即用替代）

## 快速开始

1. **下载基础包**（15MB）解压，双击 `learn-platform.exe`——内置 SQL 判题，零配置
2. 从 [Releases](../../releases) 下载想要的**语言包** zip（如 `langpack-python.zip`）
3. 软件里「题库练习」→「📦 语言包」→ 安装，开始做题

> 电脑已有 Python/JDK（在 PATH）？直接能用，语言包都可以不装。

## 学习闭环怎么转

```
做题（starter 引导）→ 判题（即时反馈）
   ↓ 未通过               ↓ 全通过
错题本 ——变体重做——→ 关卡解锁（上一组 ≥2 题开下一组）
   ↓                       ↓
AI 教练反问式分析           ✨ AI 点评代码风格 + 追问理解
```

变体重做是本框架的核心主张：错题重练时**换一组数据**——背答案无效，练的是思路。

## 三种参与方式

### 1. 加一道题
一个 JSON 文件的事，出题军规见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 2. 做一个语言包
想要 Lua、PHP、Rust？按 [PLUGIN_SPEC.md](PLUGIN_SPEC.md) 打一个 zip，
新语言判题主程序零改动接入。官方 5 个语言包的构建脚本就在仓库里。

### 3. Fork 出你自己的版本 ⭐
判题器、插件系统、学习闭环、双语框架全是现成的——
换一套 UI、换一种教学理念、换一个名字，做一个**属于你的练习场**。
它本来就是一个课程项目，我们乐见它长出一百个分支。

## 面向开发者

```bash
git clone https://github.com/Wendy7-7/ShuHaRi.git
cd ShuHaRi
npm install
npm run tauri dev      # 开发模式（需 Rust + Node 20+）
```

- 技术栈：**Tauri 2 + React 19 + Rust**（判题器全 Rust，静态编译单 exe）
- 工程化：Rust 单元测试、CDP 冒烟/耐力/压力测试脚本、GitHub Actions CI
- **二次开发看 [CONTRIBUTING.md](CONTRIBUTING.md)，做语言插件看 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)**

## 目录速览

```
src/                  前端（React + Monaco + xterm）
src-tauri/src/        后端核心
  judge.rs            判题引擎（编译型/解释型/SQL 内嵌/第三方执行器）
  langpack.rs         语言包插件框架
  db.rs               SQLite 存储（题库/错题/考试/kv）
  pty.rs              内嵌终端
workspace-template/   首次启动的工作区种子（题库 + 教程）
PLUGIN_SPEC.md        语言包插件规范 v1
.github/workflows/    CI
```

## 许可

[MIT](LICENSE) —— 学习、修改、分发、商用都随便，保留版权声明即可。
内置工具链（GCC/JDK/Python/Go/Node）的许可见各语言包内文件。

---

**一句话**：题库会过时，框架不会。
把这个判题引擎和插件系统拿走，去做一个教别的东西、长得完全不一样的软件吧——那是我们最想看到的衍生物。
