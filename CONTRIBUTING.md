# 贡献指南

欢迎任何形式的贡献：加一道题、修一个 bug、做一个新语言包、报一个 typo。

## 快速路线

| 你想做的事 | 去哪 | 难度 |
|-----------|------|------|
| 报 bug / 提建议 | Issues，附上「帮助 → 环境体检」截图 | ⭐ |
| **加一道题** | 读本文 §1，提 PR | ⭐ |
| **做一个新语言的插件包** | 读 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)（零代码改主程序） | ⭐⭐ |
| 修 bug / 改功能 | 本文 §3 | ⭐⭐⭐ |

## §1 加一道题（5 分钟学会）

题目 = 一个 JSON 文件，放 `workspace-template/bank/`：

```json
{
  "id": "py-99",
  "lang": "python",
  "title": "题目名",
  "difficulty": 1,
  "tags": ["循环"],
  "statement_md": "## 题面（Markdown）",
  "starter_code": "初始代码（留白让学生写）",
  "hints": ["提示1（先反问）", "提示2（指方法）"],
  "editorial_md": "题解（判题通过后才建议看）",
  "test_cases": [
    { "stdin": "输入\n", "expected_stdout": "期望输出\n", "timeout_ms": 8000 }
  ],
  "variant_cases": [
    { "stdin": "换一组数据\n", "expected_stdout": "换一组期望\n", "timeout_ms": 8000 }
  ]
}
```

**出题三条军规**（评审 PR 时会看）：
1. `expected_stdout` 必须真实跑过——不许拍脑袋写
2. 同一知识点的题请配 `variant_cases`（错题变体重做用，防背答案）
3. `hints` 先反问再给方法，别一上来就剧透（软件的 AI 教练也是这个原则）

## §2 做一个语言包插件

完整规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)。最小流程：

1. 写 manifest.json（声明 spec_version、题目语言、可选的 judge 执行器）
2. 打包 `runtime/`（工具链，可选）+ `bank/`（题目）+ `workspace/`（教程，可选）
3. 在干净基础包上自测：安装 → 判一题 → 卸载 → 重启无残留
4. 提 PR 把 zip 构建脚本加进 `build-langpacks.py` 的 PACKS 列表，或直接发 Release

## §3 修 bug / 开发环境

```bash
npm install
npm run tauri dev        # 开发运行
npm run tauri build -- --no-bundle   # 构建单 exe
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 单元测试（判题器）
```

- **判题器是核心资产**：改 `judge.rs` / `langpack.rs` / `db.rs` 请补单元测试
- 前端类型：`npx tsc --noEmit` 必须零错误
- 测试脚本（冒烟/耐力/魔鬼压测）在仓库根 `*.cjs`，需要运行中的应用 + 调试端口：
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9870" learn-platform.exe`
  然后 `node smoke.cjs 9870`

### 架构速记

```
前端 React ──invoke──▶ Rust 命令层
                        ├── judge.rs     判题（沙盒 + 通用执行器）
                        ├── langpack.rs  语言包生命周期（装/卸/注册）
                        ├── db.rs        SQLite（题库/错题/考试/kv）
                        └── pty.rs       内嵌终端
```

## 提交规范

- commit 信息中文/英文都行，写清楚"改了什么、为什么"
- PR 标题格式：`[题目] 加 5 道循环题` / `[判题] 修 Go 超时` / `[插件] 新增 Lua 语言包`
- 不要求签署 CLA；代码进库即 MIT

## 行为准则

对学习者友好。嘲讽可以有（对代码），攻击不可以（对人）。
