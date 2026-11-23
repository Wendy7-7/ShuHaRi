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

- **判题框架**：C/C++/Python/Java/Go/JavaScript 代码复制到隔离目录运行（超时/stdin 注入/输出规范化；无内存与文件系统隔离，勿跑来路不明的代码），
  SQL 内嵌 SQLite 零依赖，存图类任务可校验 PNG dpi
- **语言包插件系统**：每种语言一个 zip（工具链+题库+教程），装/卸/注册第三方判题执行器，
  主程序零改动接入（规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)）
- **学习闭环**：错题变体重做（换数据重练，提高背答案成本）、知识点关卡解锁、错题本、考试模式、统计、徽章
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

## 下载教学（手把手版）

### 第 1 步：打开下载页

浏览器打开 👉 **https://github.com/Wendy7-7/ShuHaRi/releases**

（或在本仓库主页右侧栏点 **Releases** 下的 **v1.5.0**）

### 第 2 步：对照下表，下载你要的文件

在 v1.5.0 的 **Assets** 区域（页面下方，点开折叠的 "Show all xx assets"），点文件名就开始下载。不想找？下面的直链**点一下就能下**：

| 你想学什么 | 下载这个 | 直链 |
|-----------|---------|------|
| 任何语言（**必下**） | 基础包 13MB | [LearnPlatform-v1.5.0-base.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/LearnPlatform-v1.5.0-base.zip) |
| Python / 数据科学 / 美赛 | 语言包 127MB | [langpack-python.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-python.zip) |
| C 或 C++ | 语言包 133MB | [langpack-c-cpp.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-c-cpp.zip) |
| Java | 语言包 193MB | [langpack-java.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-java.zip) |
| Go | 语言包 77MB | [langpack-go.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-go.zip) |
| JavaScript | 语言包 35MB | [langpack-node.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-node.zip) |
| 全都要 / U 盘党 | 全量包 1.5GB | [LearnPlatform-v1.5.0-portable.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/LearnPlatform-v1.5.0-portable.zip) |

> 只学 Python？下第 1、2 行就够了（共 140MB）。懒人或 U 盘党直接下全量包（1.5GB，含全部语言 + 工具链），一次到位。

### 第 3 步：装进软件（语言包不用解压！）

1. 解压 `LearnPlatform-v1.5.0-base.zip` → 双击 `learn-platform.exe`
2. 软件里「题库练习」→ 右上「📦 语言包」→ **从 zip 安装** → 选中刚下载的 `langpack-xxx.zip`
3. 提示安装成功，开始做题 🎉

### 常见问题

- **下载很慢 / 中途失败？** GitHub 国内直连不稳定，换时段重试通常能解决；用代理的话成功率会高很多。
- **浏览器提示"此文件可能有害"？** zip 里是开源工具链（GCC/Python 官方文件）+ 本仓库题库，代码全部开源可查，放心保留。
- **双击 exe 被杀毒拦截？** 点"仍要运行"或添加信任——软件未做数字签名（签名证书要花钱，开源项目常见）。
- **装完语言包还是判不了题？** 「帮助」→ 环境体检，看对应语言的工具链是否绿了。


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
