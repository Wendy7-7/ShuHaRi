# ShuHaRi

> **Shu** (follow the starter) → **Ha** (break it with variants) → **Ri** (make it your own).
> The three stages of mastery from Japanese swordsmanship — and the whole design philosophy of this app.

**An open-source local coding practice framework**: a Rust judging engine + a language
pack plugin system + an AI coach layer + a complete learning loop.

It ships with 65 starter problems and a data-science intro module — but the real
contribution of this project is not the problem bank. It is the **framework**:
the judge sandbox, the plugin spec, and the learning loop are all ready-made.
Anyone can load it with content, swap the content, or fork it into their own
teaching software.

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Plugin Spec](https://img.shields.io/badge/Plugin%20Spec%20v1-blue)](PLUGIN_SPEC.md)

**[简体中文](README.md) | [English](README.en.md)**

---

## What it has (honestly)

- **Judge framework**: code is copied to an isolated directory for C/C++/Python/Java/Go/JavaScript,
  with a timeout plus a **2 GB memory cap and 16-process limit** (Windows Job Object, whole process tree killed on exit; still runs as the current user — not a security sandbox)
  (timeout / stdin injection / output normalization), embedded SQLite for SQL
  with zero deps, PNG dpi verification for figure-saving tasks
- **Language pack system**: one zip per language (toolchain + problems + tutorials),
  install / uninstall / register third-party judge executors — zero changes to the
  main program (spec in [PLUGIN_SPEC.md](PLUGIN_SPEC.md))
- **Learning loop**: mistake variant redo (raises the cost of memorizing), sequential topic
  unlock, mistake archive, exam mode, stats, badges
- **AI coach layer**: bring your own OpenAI-compatible key; Socratic prompts
  (ask for the idea first, hint second, never full code)
- **Bilingual UI**: Chinese / English
- **Bundled content**: 65 starter problems + a data-science intro module
  (pandas cleaning, matplotlib figures, basic scipy)

## What it does NOT have (also honestly)

- Only 65 problems — it is **not** a problem-bank platform; content grows with the community
- The data-science module is an **intro subset** — not a complete MCM/ICM prep tool
  (that needs real contest problems, paper training, and a lot of practice)
- The AI coach and problem statements are currently in Chinese (English UI works;
  translation PRs welcome)
- No auto-update, no installer (unzip-and-run instead)

## Quick start

1. **Download the base pack** (15 MB) from [Releases](../../releases), unzip, run
   `learn-platform.exe` — SQL judging built-in, zero config
2. Download the **language pack** zips you want (e.g. `langpack-python.zip`)
3. In the app: Practice → 📦 **Lang Packs** → install — start solving

> Already have Python/JDK on PATH? It just works — packs are optional.

## Direct download links

New to GitHub? Open the [Releases page](https://github.com/Wendy7-7/ShuHaRi/releases),
then click a file name under **Assets** — or just use these direct links:

| You want to learn | Size | Link |
|---|---|---|
| Any language (**required**) | Base pack 13MB | [LearnPlatform-v1.5.0-base.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.2/LearnPlatform-1.5.2-base.zip) |
| Python / data science / MCM | 127MB | [langpack-python.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-python.zip) |
| C or C++ | 133MB | [langpack-c-cpp.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-c-cpp.zip) |
| Java | 193MB | [langpack-java.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-java.zip) |
| Go | 77MB | [langpack-go.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-go.zip) |
| JavaScript | 35MB | [langpack-node.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/langpack-node.zip) |
| Everything (USB users) | 1.5GB | [LearnPlatform-v1.5.0-portable.zip](https://github.com/Wendy7-7/ShuHaRi/releases/download/v1.5.0/LearnPlatform-v1.5.0-portable.zip) |

> Only learning Python? The first two rows are enough (140MB total). Lazy or USB users: grab the 1.5GB all-in-one pack instead.
> Lang packs still live in the v1.5.0 release (toolchains unchanged, fully compatible with the v1.5.1 base pack).

Install: unzip the base pack, run the app, then Practice → 📦 Lang Packs → install the
langpack zip (**no need to unzip it**).

> **Blank window / nothing happens on double-click?** Open `%LOCALAPPDATA%\com.learnplatform.app`
> (Win+R) and **delete the whole `EBWebView` folder**, then relaunch — most common after
> force-killing the app or a power loss. Still stuck? [Open an issue](https://github.com/Wendy7-7/ShuHaRi/issues)
> with your OS version and a screenshot.


## The learning loop

```
solve (starter guided) → judge (instant feedback)
   ↓ failed                    ↓ all passed
mistakes ——variant redo——→ topic unlock (2+ solved opens next group)
   ↓                              ↓
AI coach asks & analyzes        ✨ AI reviews your code style
```

Variant redo is the core idea of this framework: a failed problem comes back with
**new data** — memorizing answers gets you nothing; re-learning the idea does.

## Three ways to take part

### 1. Add a problem
One JSON file. The problem-writing rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

### 2. Build a language pack
Want Lua, PHP, Rust? Bundle a zip per [PLUGIN_SPEC.md](PLUGIN_SPEC.md) —
new languages plug into the judge with zero changes to the main program.
The build scripts for the 5 official packs are in this repo.

### 3. Fork it into YOUR version ⭐
The judge, the plugin system, the learning loop, the bilingual shell — all ready-made.
Swap the UI, swap the teaching philosophy, swap the name, and build **your own
practice ground**. This started as a course project; we would love to see it grow
a hundred branches.

## For developers

```bash
git clone https://github.com/Wendy7-7/ShuHaRi.git
cd ShuHaRi
npm install
npm run tauri dev      # dev mode (Rust + Node 20+)
```

- Stack: **Tauri 2 + React 19 + Rust** (the judge is pure Rust, single static exe)
- Engineering: Rust unit tests, CDP smoke/endurance/stress scripts, GitHub Actions CI
- **See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute, [PLUGIN_SPEC.md](PLUGIN_SPEC.md) for language packs**

## Repository layout

```
src/                  Frontend (React + Monaco + xterm)
src-tauri/src/        Backend core
  judge.rs            Judge engine (compiled / interpreted / embedded SQL / third-party executors)
  langpack.rs         Language pack framework
  db.rs               SQLite storage (problems / mistakes / exams / kv)
  pty.rs              Embedded terminal
workspace-template/   First-run workspace seed (problems + tutorials)
PLUGIN_SPEC.md        Language pack plugin spec v1
.github/workflows/    CI
```

## License

[MIT](LICENSE) — do anything, just keep the copyright notice.
Bundled toolchains (GCC/JDK/Python/Go/Node) carry their own licenses, see files inside each pack.

---

**One line**: problem banks age, frameworks don't.
Take this judging engine and plugin system, and build software that teaches
something else entirely, looking nothing like this — that is the derivative
we most want to see.
