# 语言包插件规范（Language Pack Plugin Spec）· 版本 1

> 本文档是第三方为 LearnPlatform 制作语言模块的唯一权威标准。
> 遵守本规范的 zip 即为合法语言包，可在软件内一键安装、卸载。
> 官方语言包（python / c-cpp / java / go / node）也按本规范构建，是最好的参考实现：
> 见 `build-langpacks.py`。

---

## 1. 包结构

语言包是一个 zip，顶层结构：

```
langpack-<id>.zip
├── manifest.json          ← 必需，包声明（见 §2）
├── runtime/               ← 可选，工具链（解压到程序 Runtime/ 下）
│   └── <目录名>/…
├── bank/                  ← 可选，题目 JSON（解压到 workspace/bank/）
│   └── *.json
└── workspace/             ← 可选，学习资料（解压到 workspace/，卸载时保留）
    └── <目录>/…
```

**三条铁律（安装器强制执行，违反直接拒装）：**
1. 任何路径条目不得包含 `..`（防路径穿越）
2. `manifest.json` 必须存在且 `spec_version` 为本规范支持的版本
3. `id` 仅限小写字母/数字/连字符，长度 ≤32

## 2. manifest.json

```json
{
  "spec_version": 1,
  "id": "python",
  "name": "Python + 数据科学",
  "version": "1.0.0",
  "runtime_dirs": ["python"],
  "bank_langs": ["python"],
  "description": "一句话说明（语言包界面展示）",
  "judge": {
    "lang": "demo",
    "display": "Demo（第三方示例）",
    "compile": null,
    "run": "解释器 {src}",
    "timeout_bonus_ms": 2000
  }
}
```

| 字段 | 必需 | 说明 |
|------|------|------|
| spec_version | ✅ | 固定 `1`。主程序不认识的版本会拒装并提示升级 |
| id | ✅ | 包唯一标识。卸载、注册都以它为准 |
| name / version / description | ✅ | 展示信息 |
| runtime_dirs | — | runtime/ 下要安装的工具链目录（卸载时整目录删除） |
| bank_langs | — | 包含哪些语言标识（卸载时清理这些语言的题目与错题） |
| judge | — | **第三方判题执行器声明**（见 §4）。官方内置语言不需要 |

## 3. 题目 JSON（bank/*.json）

单题对象（或题目数组），字段：

```json
{
  "id": "demo-01",
  "lang": "demo",
  "title": "题目标题",
  "difficulty": 1,
  "tags": ["分组名"],
  "statement_md": "## 题面（Markdown）",
  "starter_code": "初始代码",
  "hints": ["提示1", "提示2"],
  "editorial_md": "题解",
  "test_cases": [
    {
      "stdin": "3 4\n",
      "expected_stdout": "7\n",
      "timeout_ms": 8000,
      "match_mode": "exact",
      "setup_sql": null,
      "expect_file": null
    }
  ],
  "variant_cases": []
}
```

- `lang` 必须与 manifest 的 `bank_langs` 一致，且出现在 `judge.lang` 中（或为程序内置语言）
- `test_cases` 必填且非空；`timeout_ms` 默认 3000
- `match_mode`：`exact`（默认，规范化后全等）或 `contains`（输出含子串即过）
- `setup_sql`：SQL 题专用（建表语句，判题时在内存库执行）
- `expect_file`：存图类任务校验 `{ "path": "figures/x.png", "min_bytes": 3000, "dpi": 300 }`
- `variant_cases`：错题"变体重做"用的换数据用例（结构同 test_cases）
- **容错规则**：包内个别坏 JSON 会被跳过并计数，不影响其他题安装

## 4. 第三方判题执行器（judge 声明）

想让**新语言**接入判题而不用改主程序？在 manifest 声明 judge：

| 字段 | 说明 |
|------|------|
| `lang` | 题目 lang 字段用的标识（也决定练习文件后缀，如 `demo-01.demo`） |
| `display` | 语言下拉显示名 |
| `compile` | 可选编译模板：`编译器 {src} -o {out}`，失败判"编译失败" |
| `run` | 运行模板：`解释器 {src}`。**按空白拆分执行，不经 shell**（安全） |
| `timeout_bonus_ms` | 判题超时额外余量（编译型语言建议 ≥8000） |

安装时注册到程序目录 `langs/<lang>.json`，判题器遇到未知语言自动查注册表；
卸载时自动注销。前端语言下拉自动出现该语言。

**示例**（把 Lua 接进来，工具链放包里）：
```json
"judge": {
  "lang": "lua",
  "display": "Lua",
  "compile": null,
  "run": "Runtime/lua/bin/lua54 {src}",
  "timeout_bonus_ms": 2000
}
```
（run 里的程序名会先在 PATH 与 Runtime 增强路径中查找）

## 5. 判题行为契约（所有语言一致）

- 学生代码复制到独立沙盒目录运行，stdin/超时按用例注入
- 输出规范化：统一换行、去行尾空白后比对
- 产物校验（expect_file）在 stdout 判定后叠加
- 三态结果：通过 / 答案错误（期望 vs 实际）/ 运行错误（stderr 或超时）

## 6. 卸载契约

卸载语言包时主程序会：
1. 删除 `runtime_dirs` 声明的工具链目录
2. 删除该包安装的题目文件（bank JSON）与数据库中该语言的题目、错题
3. 注销 judge 执行器（langs/<lang>.json）
4. **保留** workspace/ 学习资料（教程、数据集）——那是用户的笔记资产

## 7. 版本与兼容承诺

- `spec_version` 不变时，主程序小版本升级**必须**继续兼容已装语言包
- 主程序新增规范能力（新字段）一律向后兼容（serde default）
- 想废弃能力 → 发布 spec_version 2，旧包提示用户更新

## 8. 自检清单（发布你的语言包前）

- [ ] manifest.spec_version = 1
- [ ] id 合法（小写/数字/连字符）
- [ ] zip 内无 `..` 路径
- [ ] 每道题的 lang 与 manifest 一致
- [ ] 每道题都有非空 test_cases，期望输出可复现
- [ ] 在干净基础包上实测：安装 → 判一道题 → 卸载 → 重启无残留
