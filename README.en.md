# ShuHaRi

> **Shu** (follow the starter) → **Ha** (break it with variants) → **Ri** (make it your own).
> The three stages of mastery from Japanese swordsmanship — and the whole design philosophy of this app.

**[简体中文](README.md) | [English](README.en.md)**

---

**A local-first coding practice ground for self-learners**: instant judging (fully offline),
a Socratic AI coach (uses your own API key), and pluggable language packs.

No account, nothing to sign up for. The portable build even skips toolchain setup —
all your data stays on your own computer (or USB stick).

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Plugin Spec](https://img.shields.io/badge/Plugin%20Spec%20v1-blue)](PLUGIN_SPEC.md)

---

## What is this

Try it if any of these is you:

- You're **learning to code alone**, and judge-only sites just say "Wrong Answer" — never *why*, never *what next*
- You want to practice **many languages** (C/C++/Python/Java/Go/JavaScript/SQL) without stuffing your machine with toolchains
- You're prepping for **MCM/ICM**: pandas cleaning → matplotlib figures → statistical inference, one complete path
- You're a student: lab computers ≠ your computer — USB plug-and-play, records travel with you

## Quick Start

1. **Download the base pack** (15 MB) from [Releases](../../releases), unzip, run `learn-platform.exe`
2. Grab a **language pack** zip for what you want to learn (e.g. `langpack-python.zip`, 127 MB with pandas + the MCM modules)
3. In the app: Practice → 📦 **Lang Packs** → install that zip — start solving

> SQL judging is built-in (zero deps) — 6 SQL problems work with nothing installed.
> Already have Python/JDK on PATH? The toolchain check recognizes it — packs are optional.

## Core Features

### 🎯 Judging: local sandbox, instant feedback
7 languages. Code runs in an isolated directory with per-case feedback on
stdout / timeout / compile errors — even saved-figure DPI is verified.

### 🧭 AI Coach: guided, not spoon-fed
Coach mode asks you questions first, points at methods, never dumps full solutions.
After a passing judge, one click gets your code style reviewed — including where
this approach would break. Bring your own OpenAI-compatible key.

### 🔁 Mistake loop: practice thinking, not memorizing
Failed problems are auto-archived and counted by topic. "Variant Redo" gives a
mistake **new data** — so you re-learn the idea, not the answer.

### 📈 MCM data-science path
pandas cleaning → publication-grade matplotlib figures (300 dpi verified) →
scipy inference (t-test / curve_fit / solve_ivp).

### 🧩 Pluggable language packs
One independent pack per language (toolchain + problems + tutorials), installed
and removed on demand. Anyone can build a new language pack per
[PLUGIN_SPEC.md](PLUGIN_SPEC.md) — zero changes to the main program.

### 💾 Local-first · portable
No account, no cloud, no tracking. 15 MB base pack, move by copying a folder.

## The learning loop

```
solve (starter guided) → judge (instant feedback)
   ↓ failed                    ↓ all passed
mistakes ——variant redo——→ topic unlock (2+ solved opens next group)
   ↓                              ↓
AI coach asks & analyzes        ✨ AI reviews your code style
```

## For developers

```bash
git clone https://github.com/Wendy7-7/ShuHaRi.git
cd ShuHaRi
npm install
npm run tauri dev      # dev mode (Rust + Node 20+)
```

- Stack: **Tauri 2 + React 19 + Rust** (the judge is pure Rust, single static exe)
- Judge sandbox: isolated dir, timeout / stdin injection / output normalization / artifact checks
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
workspace-template/   First-run workspace seed (65 problems + tutorials)
PLUGIN_SPEC.md        Language pack plugin spec v1
.github/workflows/    CI
```

## License

[MIT](LICENSE) — do anything, just keep the copyright notice.
Bundled toolchains (GCC/JDK/Python/Go/Node) carry their own licenses, see files inside each pack.

> Note: the AI coach currently converses in Chinese, and problem statements are in Chinese.
> Translations welcome via PR.

---

**One line for self-learners**: this app exists for a single reason — when you're
learning to code alone, it plays the coach who asks you questions, makes you redo
your mistakes with new data, and finds fault even when you get it right.
