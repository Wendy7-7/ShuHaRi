# LearnPlatform

**给自学编程者的离线练习场**：判题即时反馈 + AI 教练引导 + 语言按需安装。

写代码、判题、看错题、闯关卡、问 AI——一个 zip 解压就能用，不需要联网注册，
不需要配置环境，数据全部留在自己电脑（或 U 盘）里。

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Plugin Spec](https://img.shields.io/badge/插件规范-v1-blue)](PLUGIN_SPEC.md)

---

## 30 秒决定要不要用

如果你符合下面任意一条，值得试试：

- **自学编程**，但刷题网站只告诉你"答案错误"，没人告诉你"为什么错、下一步学什么"
- 想练**多种语言**（C/C++/Python/Java/Go/JavaScript/SQL），但不想电脑被各种工具链塞满
- 备赛**数学建模（MCM/ICM）**：pandas 清洗 → matplotlib 出图 → 统计推断，一条完整路径
- 学生党：机房电脑 ≠ 自己电脑，U 盘即插即用，学习记录随身带走

## 三步上手

1. **下载基础包**（15MB）解压，双击 `learn-platform.exe`
2. 想学什么语言，从 [Releases](../../releases) 下载对应**语言包** zip（如 `langpack-python.zip`，127MB 含 Python+pandas+美赛模块）
3. 软件里「题库练习」→「📦 语言包」→ 安装那个 zip，开始做题

> SQL 判题内置（零依赖），不用装任何东西就能先做 6 道 SQL 题。
> 你电脑已有 Python/JDK？工具链检测直接认，语言包都可以不装。
> 嫌下载麻烦？Releases 里也有 1.5GB 全量包，一次到位。

## English Quick Start

**ShuHaRi** is an offline coding practice ground for self-learners:
instant judge, a Socratic AI coach (it asks *you* questions instead of
handing out answers), mistake-driven variant redo, and pluggable language packs.

1. Download the base zip (15 MB), unzip, run learn-platform.exe
2. Grab a langpack from Releases (langpack-python.zip, langpack-go.zip, ...)
3. Practice -> Lang Packs -> install the zip - done
4. UI language: Settings -> Interface Language -> English
   (AI coach currently replies in Chinese; question statements are in Chinese)

## 它跟刷题网站有什么不同

| | 刷题网站 | LearnPlatform |
|---|---|---|
| 判题 | 只对答案 | 同样对答案，**外加分级提示和错题变体重做** |
| AI | 给答案或不说人话 | **教练模式**：先反问你 → 指方法 → 才给片段；判题后主动点评代码风格 |
| 数据 | 账号在云端 | 全本地：U 盘拷走即迁移，无人知道你做错了什么 |
| 内容 | 算法为主 | 算法 + **美赛数据科学**（pandas/绘图/统计/scipy 全路径） |
| 语言 | 固定 | **插件化**：想要的语言社区自己造（见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)） |

## 学习闭环怎么转

```
做题（starter 引导）→ 判题（即时反馈）
   ↓ 未通过               ↓ 全通过
错题本 ——变体重做——→ 关卡解锁（上一组 ≥2 题开下一组）
   ↓                       ↓
AI 教练反问式分析           ✨ AI 点评代码风格 + 追问理解
```

- **变体重做**：错题重练时换一组数据——背答案没用，练的是思路
- **关卡解锁**：知识点按学习路径依次开锁，也可以切"自由模式"
- **AI 教练**：自带 OpenAI 兼容 Key 即可启用（应用内「帮助」有配置教程），全程本地调用

## 面向开发者

```bash
git clone https://github.com/<你的账号>/learn-platform.git
cd learn-platform
npm install
npm run tauri dev      # 开发模式（需 Rust + Node 20+）
```

- 技术栈：**Tauri 2 + React 19 + Rust**（判题器全 Rust，静态编译单 exe）
- 判题沙盒：学生代码在隔离目录运行，支持超时/stdin 注入/输出规范化/产物校验（PNG dpi 都能验）
- 工程化：Rust 单元测试、CDP 冒烟/耐力/魔鬼压力脚本、GitHub Actions CI
- **二次开发看 [CONTRIBUTING.md](CONTRIBUTING.md)，做语言插件看 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)**

## 目录速览

```
src/                  前端（React + Monaco + xterm）
src-tauri/src/        后端核心
  judge.rs            判题引擎（编译型/解释型/SQL 内嵌/第三方执行器）
  langpack.rs         语言包插件框架
  db.rs               SQLite 存储（题库/错题/考试/kv）
  pty.rs              内嵌终端
workspace-template/   首次启动的工作区种子（题库 65 题 + 教程）
PLUGIN_SPEC.md        语言包插件规范 v1
.github/workflows/    CI
```

## 许可

[MIT](LICENSE) —— 学习、修改、分发、商用都随便，保留版权声明即可。
内置工具链（GCC/JDK/Python/Go/Node）的许可见各语言包内文件。

---

**给自学者的一句话**：这个软件存在的理由只有一个——你一个人学编程的时候，
它扮演那个会反问你、会盯你重做错题、会在你写对时挑刺的教练。
