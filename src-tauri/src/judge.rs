use crate::db::TestCase;
use serde::Serialize;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone)]
#[derive(Debug)]
pub struct CaseResult {
    pub index: usize,
    pub pass: bool,
    /// 通过 / 答案错误 / 超时 / 运行错误 / 编译失败
    pub status: String,
    pub expected: Option<String>,
    pub actual: Option<String>,
    pub time_ms: u64,
}

struct RunOutcome {
    stdout: String,
    stderr: String,
    timed_out: bool,
    failed_to_start: Option<String>,
    time_ms: u64,
}

/// 运行命令：stdin 单独线程写入；stdout/stderr 单独线程读取（防管道写满死锁）；轮询超时 kill
fn run_cmd(mut cmd: Command, stdin_data: Option<String>, timeout: Duration) -> RunOutcome {
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return RunOutcome {
                stdout: String::new(),
                stderr: String::new(),
                timed_out: false,
                failed_to_start: Some(e.to_string()),
                time_ms: 0,
            }
        }
    };

    let mut stdin = child.stdin.take();
    let writer = std::thread::spawn(move || {
        if let (Some(s), Some(d)) = (stdin.as_mut(), stdin_data) {
            let _ = s.write_all(d.as_bytes());
        }
    });

    let stdout_pipe = child.stdout.take().unwrap();
    let stderr_pipe = child.stderr.take().unwrap();
    // 输出上限 1MB：防刷屏程序在超时窗口内吃光内存
    let out_handle = std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stdout_pipe.take(1_000_000).read_to_string(&mut buf);
        buf
    });
    let err_handle = std::thread::spawn(move || {
        let mut buf = String::new();
        let _ = stderr_pipe.take(200_000).read_to_string(&mut buf);
        buf
    });

    let start = Instant::now();
    let mut timed_out = false;
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    timed_out = true;
                    break;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(_) => break,
        }
    }
    let _ = writer.join();
    RunOutcome {
        stdout: out_handle.join().unwrap_or_default(),
        stderr: err_handle.join().unwrap_or_default(),
        timed_out,
        failed_to_start: None,
        time_ms: start.elapsed().as_millis() as u64,
    }
}

fn normalize(s: &str) -> String {    let mut lines: Vec<String> = s
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .split('\n')
        .map(|l| l.trim_end().to_string())
        .collect();
    while lines.last().map(|l| l.is_empty()).unwrap_or(false) {
        lines.pop();
    }
    lines.join("\n")
}

fn temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "learn_judge_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn find_tool(name: &str) -> Option<String> {
    // 便携 Runtime 优先 → 系统 PATH
    crate::portable::find_tool(name)
}

/// 判题主命令：编译（C/C++）后逐用例运行比对
#[tauri::command]
pub async fn judge(
    code_path: String,
    lang: String,
    cases: Vec<TestCase>,
) -> Result<Vec<CaseResult>, String> {
    tauri::async_runtime::spawn_blocking(move || judge_sync(code_path, lang, cases))
        .await
        .map_err(|e| e.to_string())?
}

fn judge_sync(code_path: String, lang: String, cases: Vec<TestCase>) -> Result<Vec<CaseResult>, String> {
    if lang == "sql" {
        return judge_sql(code_path, cases);
    }
    let dir = temp_dir();
    let src = dir.join(
        Path::new(&code_path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "main.c".into()),
    );
    std::fs::copy(&code_path, &src).map_err(|e| format!("读取代码失败: {}", e))?;

    let exe: Option<std::path::PathBuf>;
    let mut custom_judge: Option<crate::langpack::JudgeSpec> = None;
    match lang.as_str() {
        "c" | "cpp" => {
            let compiler = if lang == "c" { "gcc" } else { "g++" };
            let compiler_path = match find_tool(compiler) {
                Some(p) => p,
                None => {
                    let _ = std::fs::remove_dir_all(&dir);
                    return Err(format!("未检测到 {}，请先安装（如 w64devkit / MinGW）", compiler));
                }
            };
            // 注意：内置 MinGW g++ 8.1 只支持到 C++17，写 c++20 会直接编译失败
            let std_flag = if lang == "c" { "-std=c17" } else { "-std=c++17" };
            let out = dir.join("sol.exe");
            let mut cmd = Command::new(&compiler_path);
            // -static：产物不依赖本机 MinGW DLL，换台电脑/U 盘也能跑
            cmd.arg("-O2")
                .arg("-static")
                .arg(std_flag)
                .arg(&src)
                .arg("-o")
                .arg(&out)
                .env("PATH", crate::portable::path_with_tools());
            let result = run_cmd(cmd, None, Duration::from_secs(20));
            if result.timed_out {
                let _ = std::fs::remove_dir_all(&dir);
                return Err("编译超时".into());
            }
            if !out.exists() {
                let _ = std::fs::remove_dir_all(&dir);
                return Err(format!(
                    "编译失败:\n{}",
                    result.stderr.lines().take(30).collect::<Vec<_>>().join("\n")
                ));
            }
            exe = Some(out);
        }
        "java" => {
            let javac = match find_tool("javac") {
                Some(p) => p,
                None => {
                    let _ = std::fs::remove_dir_all(&dir);
                    return Err("未检测到 javac，请安装 JDK 21（或把 JDK 放进 Runtime/jdk）".into());
                }
            };
            // Java 要求入口类与文件名对应：统一以 Main.java 编译（支持 public class Main / class Main）
            let main_src = dir.join("Main.java");
            std::fs::copy(&code_path, &main_src).map_err(|e| format!("读取代码失败: {}", e))?;
            let mut cmd = Command::new(&javac);
            cmd.arg("-encoding")
                .arg("UTF-8")
                .arg(&main_src)
                .arg("-d")
                .arg(&dir)
                .env("PATH", crate::portable::path_with_tools());
            let result = run_cmd(cmd, None, Duration::from_secs(30));
            if result.timed_out {
                let _ = std::fs::remove_dir_all(&dir);
                return Err("编译超时".into());
            }
            if !dir.join("Main.class").exists() {
                let _ = std::fs::remove_dir_all(&dir);
                return Err(format!(
                    "编译失败:\n{}",
                    result.stderr.lines().take(30).collect::<Vec<_>>().join("\n")
                ));
            }
            exe = None;
        }
        "python" | "python3" => {
            if find_tool("python").is_none() {
                let _ = std::fs::remove_dir_all(&dir);
                return Err("未检测到 python，请先安装".into());
            }
            exe = None;
        }
        "go" => {
            if find_tool("go").is_none() {
                let _ = std::fs::remove_dir_all(&dir);
                return Err("未检测到 Go，请安装 Go（或放入 Runtime/go）".into());
            }
            exe = None;
        }
        "javascript" | "js" | "node" => {
            if find_tool("node").is_none() {
                let _ = std::fs::remove_dir_all(&dir);
                return Err("未检测到 Node.js，请安装（或放入 Runtime/node）".into());
            }
            exe = None;
        }        other => {
            // 第三方语言：从 langs/<lang>.json 注册表读取执行器声明（语言包插件标准）
            match load_lang_registry(&lang) {
                Some(spec) => {
                    exe = None;
                    custom_judge = Some(spec);
                }
                None => {
                    let _ = std::fs::remove_dir_all(&dir);
                    return Err(format!("暂不支持的语言: {}（也没有对应的语言包注册）", other));
                }
            }
        }
    }

    let mut results = Vec::new();
    // pandas 教学：把工作区 mcm/ 目录复制到判题临时目录，让代码里的相对路径 data/... 可解析
    if lang == "python" || lang == "python3" {
        if let Some(ws) = Path::new(&code_path).parent().and_then(|p| p.parent()) {
            let mcm = ws.join("mcm");
            if mcm.is_dir() {
                copy_dir_recursive(&mcm, &dir.join("mcm"));
            }
        }
    }
    for (i, case) in cases.iter().enumerate() {
        let timeout = Duration::from_millis(case.timeout_ms.max(200));
        let outcome = match &exe {
            Some(bin) => {
                let mut cmd = Command::new(bin);
                cmd.current_dir(&dir);
                // 静态链接后理论上不依赖 DLL，但仍带上便携 PATH 兜底
                cmd.env("PATH", crate::portable::path_with_tools());
                run_cmd(cmd, Some(case.stdin.clone()), timeout)
            }
            None => {
                if lang == "java" {
                    // Java 走 class 文件：java -cp <dir> Main，JVM 启动慢给额外宽限
                    let java = find_tool("java").unwrap_or_else(|| "java".to_string());
                    let mut cmd = Command::new(java);
                    cmd.arg("-Dfile.encoding=UTF-8")
                        .arg("-cp")
                        .arg(&dir)
                        .arg("Main");
                    cmd.current_dir(&dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout + Duration::from_millis(1500))
                } else if lang == "go" {
                    // go run 编译+运行一体；GOCACHE 用数据目录持久缓存（首次编译标准库慢，临时缓存会拖累每次判题）
                    let go = find_tool("go").unwrap_or_else(|| "go".to_string());
                    let cache = crate::portable::data_dir().join("gocache");
                    let _ = std::fs::create_dir_all(&cache);
                    let mut cmd = Command::new(go);
                    cmd.arg("run").arg(&src);
                    cmd.current_dir(&dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    cmd.env("GOCACHE", &cache);
                    // go run 首次编译标准库可能超过 10s，给足编译余量
                    run_cmd(cmd, Some(case.stdin.clone()), timeout + Duration::from_millis(8000))
                } else if lang == "javascript" || lang == "js" || lang == "node" {
                    let node = find_tool("node").unwrap_or_else(|| "node".to_string());
                    let mut cmd = Command::new(node);
                    cmd.arg(&src);
                    cmd.current_dir(&dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout)
                } else if let Some(spec) = &custom_judge {
                    // 第三方语言执行器：按语言包注册的模板运行（空白拆分，不经 shell）
                    let src_str = src.to_string_lossy().to_string();
                    let mut parts: Vec<String> = spec
                        .run
                        .replace("{src}", &src_str)
                        .split_whitespace()
                        .map(|s| s.to_string())
                        .collect();
                    if parts.is_empty() {
                        return Err("语言包执行器 run 模板为空".into());
                    }
                    let prog = parts.remove(0);
                    let resolved = find_tool(&prog).unwrap_or(prog);
                    let mut cmd = Command::new(resolved);
                    cmd.args(&parts);
                    cmd.current_dir(&dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout + Duration::from_millis(spec.timeout_bonus_ms))
                } else {
                    let py = find_tool("python").unwrap_or_else(|| "python".to_string());
                    let mut cmd = Command::new(py);
                    cmd.arg(&src);
                    // pandas 题目用相对路径读 data/，必须锚定到判题目录
                    cmd.current_dir(&dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout)
                }
            }
        };

        let result = if outcome.failed_to_start.is_some() {
            CaseResult {
                index: i,
                pass: false,
                status: "运行错误".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: outcome.failed_to_start,
                time_ms: 0,
            }
        } else if outcome.timed_out {
            CaseResult {
                index: i,
                pass: false,
                status: "超时".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: None,
                time_ms: outcome.time_ms,
            }
        } else if !outcome.stderr.trim().is_empty() && outcome.stdout.trim().is_empty() {
            CaseResult {
                index: i,
                pass: false,
                status: "运行错误".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: Some(outcome.stderr.lines().take(10).collect::<Vec<_>>().join("\n")),
                time_ms: outcome.time_ms,
            }
        } else {
            let actual = normalize(&outcome.stdout);
            let expected = normalize(&case.expected_stdout);
            // contains 模式：pandas 等 DataFrame 输出格式随版本有差异，只校验关键子串
            let is_contains = case.match_mode.as_deref() == Some("contains");
            let passed = if case.expect_file.is_some() && expected.is_empty() {
                true // 纯文件产物题（matplotlib 存图）：stdout 不校验，交给 expect_file 判定
            } else if is_contains {
                !expected.is_empty() && actual.contains(&expected)
            } else {
                actual == expected
            };
            CaseResult {
                index: i,
                pass: passed,
                status: if passed { "通过".into() } else { "答案错误".into() },
                expected: Some(expected),
                actual: Some(actual),
                time_ms: outcome.time_ms,
            }
        };
        // 文件产物检查（matplotlib 存图型任务）：与 stdout 判定取与
        let mut result = result;
        if let Some(ef) = &case.expect_file {
            let fp = dir.join(&ef.path);
            let mut note: Option<String> = None;
            if !fp.exists() {
                note = Some(format!("未生成文件 {}", ef.path));
            } else {
                let size = std::fs::metadata(&fp).map(|m| m.len()).unwrap_or(0);
                if let Some(min) = ef.min_bytes {
                    if size < min {
                        note = Some(format!("{} 仅 {} 字节（要求 ≥{}）", ef.path, size, min));
                    }
                }
                if note.is_none() {
                    if let Some(want) = ef.dpi {
                        match png_dpi(&fp) {
                            Some(d) if (d as i64 - want as i64).abs() <= 2 => {}
                            other => {
                                note = Some(format!("{} 的 dpi={:?}，要求 {}", ef.path, other, want));
                            }
                        }
                    }
                }
            }
            if let Some(n) = note {
                result.pass = false;
                result.status = "产物不符".into();
                result.actual = Some(n);
            }
        }
        results.push(result);
    }

    let _ = std::fs::remove_dir_all(&dir);
    Ok(results)
}

/// 工具链检测：返回各工具是否可用
#[tauri::command]
pub async fn check_toolchain() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        Ok(serde_json::json!({
            "gcc": find_tool("gcc").is_some(),
            "g++": find_tool("g++").is_some(),
            "python": find_tool("python").is_some(),
            "java": find_tool("javac").is_some() && find_tool("java").is_some(),
            "go": find_tool("go").is_some(),
            "node": find_tool("node").is_some(),
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 递归复制目录（跳过隐藏文件），用于 pandas 判题的数据集准备
fn copy_dir_recursive(src: &Path, dst: &Path) {
    let _ = std::fs::create_dir_all(dst);
    if let Ok(entries) = std::fs::read_dir(src) {
        for e in entries.flatten() {
            let name = e.file_name();
            if name.to_string_lossy().starts_with('.') {
                continue;
            }
            let p = e.path();
            let target = dst.join(&name);
            if p.is_dir() {
                copy_dir_recursive(&p, &target);
            } else {
                let _ = std::fs::copy(&p, &target);
            }
        }
    }
}

/// 读取 PNG 的 DPI（pHYs chunk，unit=1 表示每米像素数）
fn png_dpi(path: &Path) -> Option<u32> {
    let data = std::fs::read(path).ok()?;
    let pos = data.windows(4).position(|w| w == b"pHYs")?;
    if pos + 13 > data.len() {
        return None;
    }
    let x_ppm = u32::from_be_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]]);
    let unit = data[pos + 12];
    if unit == 1 {
        Some((x_ppm as f64 * 0.0254).round() as u32)
    } else {
        None
    }
}

/// SQL 判题：内嵌 SQLite（零外部工具链），执行 setup_sql 建库后运行学生查询，结果集格式化比对
fn judge_sql(code_path: String, cases: Vec<TestCase>) -> Result<Vec<CaseResult>, String> {
    let sql = std::fs::read_to_string(&code_path).map_err(|e| format!("读取 SQL 失败: {}", e))?;
    let conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for (i, case) in cases.iter().enumerate() {
        let started = std::time::Instant::now();
        if let Some(setup) = &case.setup_sql {
            if let Err(e) = conn.execute_batch(setup) {
                return Err(format!("题目数据初始化失败: {}", e));
            }
        }
        // 只允许只读查询（SELECT/WITH），防止学生语句破坏数据影响后续用例
        let trimmed = sql.trim_start().to_lowercase();
        if !(trimmed.starts_with("select") || trimmed.starts_with("with")) {
            results.push(CaseResult {
                index: i,
                pass: false,
                status: "运行错误".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: Some("请只写 SELECT / WITH 查询（本练习不需要修改数据）".into()),
                time_ms: 0,
            });
            continue;
        }

        let outcome = (|| -> Result<String, String> {
            let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL 语法错误: {}", e))?;
            let col_count = stmt.column_count();
            let names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
            let mut out = names.join(" | ") + "\n";
            let mut rows = stmt.query([]).map_err(|e| format!("执行失败: {}", e))?;
            while let Some(row) = rows.next().map_err(|e| e.to_string())? {
                let mut vals = Vec::new();
                for c in 0..col_count {
                    let v: rusqlite::types::Value = row.get(c).map_err(|e| e.to_string())?;
                    vals.push(match v {
                        rusqlite::types::Value::Null => "NULL".into(),
                        rusqlite::types::Value::Integer(n) => n.to_string(),
                        rusqlite::types::Value::Real(f) => format!("{}", f),
                        rusqlite::types::Value::Text(t) => t,
                        rusqlite::types::Value::Blob(_) => "<blob>".into(),
                    });
                }
                out.push_str(&vals.join(" | "));
                out.push('\n');
            }
            Ok(out)
        })();

        match outcome {
            Ok(text) => {
                let actual = normalize(&text);
                let expected = normalize(&case.expected_stdout);
                let is_contains = case.match_mode.as_deref() == Some("contains");
                let passed = if is_contains {
                    !expected.is_empty() && actual.contains(&expected)
                } else {
                    actual == expected
                };
                results.push(CaseResult {
                    index: i,
                    pass: passed,
                    status: if passed { "通过".into() } else { "答案错误".into() },
                    expected: Some(expected),
                    actual: Some(actual),
                    time_ms: started.elapsed().as_millis() as u64,
                });
            }
            Err(e) => {
                results.push(CaseResult {
                    index: i,
                    pass: false,
                    status: "运行错误".into(),
                    expected: Some(normalize(&case.expected_stdout)),
                    actual: Some(e),
                    time_ms: started.elapsed().as_millis() as u64,
                });
            }
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_crlf_and_trailing_spaces() {
        assert_eq!(normalize("hello\r\nworld\n"), "hello\nworld");
        assert_eq!(normalize("  a  \nb\t\n"), "  a\nb");
        assert_eq!(normalize(""), "");
    }

    #[test]
    fn normalize_handles_lone_cr() {
        assert_eq!(normalize("a\rb"), "a\nb");
    }

    #[test]
    fn png_dpi_reads_phYs_chunk() {
        // 手工构造最小 PNG：签名 + IHDR + pHYs(300dpi=11811ppm) + IEND
        let mut png: Vec<u8> = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        fn chunk(png: &mut Vec<u8>, ctype: &[u8; 4], data: &[u8]) {
            png.extend_from_slice(&(data.len() as u32).to_be_bytes());
            png.extend_from_slice(ctype);
            png.extend_from_slice(data);
            png.extend_from_slice(&[0, 0, 0, 0]); // CRC 省略（png_dpi 不校验）
        }
        chunk(&mut png, b"IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
        chunk(&mut png, b"pHYs", &[0, 0, 0x2E, 0x13, 0, 0, 0x2E, 0x13, 1]); // 11811 ppm
        chunk(&mut png, b"IEND", &[]);
        let dir = std::env::temp_dir().join("lp_test_png_ok");
        let _ = std::fs::create_dir_all(&dir);
        let p = dir.join("t.png");
        std::fs::write(&p, &png).unwrap();
        assert_eq!(png_dpi(&p), Some(300));
    }

    #[test]
    fn png_dpi_none_for_bad_file() {
        let p = std::env::temp_dir().join("lp_test_png_bad/bad.png");
        let _ = std::fs::create_dir_all(p.parent().unwrap());
        std::fs::write(&p, b"not a png").unwrap();
        assert_eq!(png_dpi(&p), None);
    }

    #[test]
    fn judge_sql_select_and_reject_non_query() {
        let dir = std::env::temp_dir().join("lp_test_sql");
        let _ = std::fs::create_dir_all(&dir);
        let f = dir.join("q.sql");
        std::fs::write(&f, "SELECT a FROM t ORDER BY a;").unwrap();
        let cases = vec![crate::db::TestCase {
            stdin: String::new(),
            expected_stdout: "a\n1\n2".into(),
            timeout_ms: 5000,
            match_mode: None,
            expect_file: None,
            setup_sql: Some("CREATE TABLE t(a INTEGER);INSERT INTO t VALUES(2),(1);".into()),
        }];
        let r = judge_sql(f.to_string_lossy().to_string(), cases).unwrap();
        assert!(r[0].pass, "应通过: {:?}", r[0]);

        // 非 SELECT 一律拒绝
        std::fs::write(&f, "DELETE FROM t;").unwrap();
        let r2 = judge_sql(
            f.to_string_lossy().to_string(),
            vec![crate::db::TestCase {
                stdin: String::new(),
                expected_stdout: String::new(),
                timeout_ms: 5000,
                match_mode: None,
                expect_file: None,
                setup_sql: Some("CREATE TABLE t(a INTEGER);".into()),
            }],
        )
        .unwrap();
        assert!(!r2[0].pass);
        assert!(r2[0].actual.as_deref().unwrap_or("").contains("SELECT"));
    }
}

/// 读取第三方语言执行器注册（exe 同目录 langs/<lang>.json，由语言包安装时写入）
fn load_lang_registry(lang: &str) -> Option<crate::langpack::JudgeSpec> {
    let exe = std::env::current_exe().ok()?;
    let p = exe.parent()?.join("langs").join(format!("{}.json", lang));
    let text = std::fs::read_to_string(p).ok()?;
    serde_json::from_str(&text).ok()
}
