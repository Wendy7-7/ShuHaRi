use crate::db::TestCase;
use serde::Serialize;
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Serialize, Clone, Debug)]
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
    exit_status: Option<ExitStatus>,
    wait_error: Option<String>,
    time_ms: u64,
    #[cfg(all(test, windows))]
    job_attached: bool,
}

impl RunOutcome {
    fn success(&self) -> bool {
        !self.timed_out
            && self.failed_to_start.is_none()
            && self.wait_error.is_none()
            && self.exit_status.is_some_and(|s| s.success())
    }

    fn failure_message(&self) -> String {
        if let Some(error) = self.failed_to_start.as_ref().or(self.wait_error.as_ref()) {
            return error.clone();
        }
        let detail = self.stderr.lines().take(10).collect::<Vec<_>>().join("\n");
        let status = self
            .exit_status
            .map(|s| s.to_string())
            .unwrap_or_else(|| "未取得退出状态".into());
        if detail.is_empty() {
            status
        } else {
            format!("{}\n{}", status, detail)
        }
    }
}

#[cfg(all(test, windows))]
thread_local! {
    /// 测试专用开关：模拟 Job Object 附加失败，验证 fail-closed 清理。
    /// thread_local 保证只影响当前测试线程（Rust 测试默认每个测试独立线程）。
    static FORCE_JOB_ATTACH_FAILURE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn read_capped(mut pipe: impl Read, limit: usize) -> String {
    let mut output = Vec::new();
    let mut buffer = [0; 8192];
    while let Ok(count) = pipe.read(&mut buffer) {
        if count == 0 {
            break;
        }
        let keep = count.min(limit.saturating_sub(output.len()));
        output.extend_from_slice(&buffer[..keep]);
    }
    String::from_utf8_lossy(&output).into_owned()
}

/// 分线程处理三个管道；超时后终止进程，并保留真实退出状态或等待错误。
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
                exit_status: None,
                wait_error: None,
                time_ms: 0,
                #[cfg(all(test, windows))]
                job_attached: false,
            };
        }
    };
    #[cfg(windows)]
    let sandbox = {
        #[cfg(all(test, windows))]
        {
            if FORCE_JOB_ATTACH_FAILURE.with(|flag| flag.get()) {
                None
            } else {
                use std::os::windows::io::AsRawHandle;
                crate::sandbox::attach(child.as_raw_handle(), 2048, 16)
            }
        }
        #[cfg(not(all(test, windows)))]
        {
            use std::os::windows::io::AsRawHandle;
            crate::sandbox::attach(child.as_raw_handle(), 2048, 16)
        }
    };
    #[cfg(all(test, windows))]
    let job_attached = sandbox.is_some();
    // 无法建立资源限制时不做静默降级：停止已启动进程，避免学生代码在无限制下失控。
    #[cfg(windows)]
    if sandbox.is_none() {
        let _ = child.kill();
        let _ = child.wait();
        return RunOutcome {
            stdout: String::new(),
            stderr: String::new(),
            timed_out: false,
            failed_to_start: Some(
                "无法建立判题资源限制（Job Object），已停止运行以免学生代码失控".into(),
            ),
            exit_status: None,
            wait_error: None,
            time_ms: 0,
            #[cfg(all(test, windows))]
            job_attached: false,
        };
    }
    let mut stdin = child.stdin.take();
    let writer = std::thread::spawn(move || {
        if let (Some(s), Some(d)) = (stdin.as_mut(), stdin_data) {
            let _ = s.write_all(d.as_bytes());
        }
    });
    let stdout_pipe = child.stdout.take().unwrap();
    let stderr_pipe = child.stderr.take().unwrap();
    // 达到保留上限后仍排空管道，避免输出截断改变被测进程的退出状态。
    let out_handle = std::thread::spawn(move || read_capped(stdout_pipe, 1_000_000));
    let err_handle = std::thread::spawn(move || read_capped(stderr_pipe, 200_000));
    let start = Instant::now();
    let mut timed_out = false;
    let mut exit_status = None;
    let mut wait_error = None;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_status = Some(status);
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    match child.wait() {
                        Ok(status) => exit_status = Some(status),
                        Err(error) => wait_error = Some(error.to_string()),
                    }
                    break;
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(error) => {
                wait_error = Some(error.to_string());
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
        }
    }
    // 关闭 Job，终止仍持有管道的子孙进程，确保所有读取线程能结束。
    #[cfg(windows)]
    drop(sandbox);
    let _ = writer.join();
    RunOutcome {
        stdout: out_handle.join().unwrap_or_default(),
        stderr: err_handle.join().unwrap_or_default(),
        timed_out,
        failed_to_start: None,
        exit_status,
        wait_error,
        time_ms: start.elapsed().as_millis() as u64,
        #[cfg(all(test, windows))]
        job_attached,
    }
}

fn normalize(s: &str) -> String {
    let mut lines: Vec<String> = s
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

struct TempDir(std::path::PathBuf);

impl TempDir {
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn temp_dir() -> Result<TempDir, String> {
    static NEXT_ID: AtomicU64 = AtomicU64::new(0);
    loop {
        let dir = std::env::temp_dir().join(format!(
            "learn_judge_{}_{}_{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        match std::fs::create_dir(&dir) {
            Ok(()) => return Ok(TempDir(dir)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("创建判题临时目录失败: {}", error)),
        }
    }
}

fn write_input_asset(dir: &Path, path: &str, content: &[u8]) -> Result<(), String> {
    let relative = Path::new(path);
    if path.is_empty()
        || relative.is_absolute()
        || path.contains("\\")
        || path.contains(":")
        || relative
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
    {
        return Err(format!("不安全的输入路径: {}", path));
    }
    let target = dir.join(relative);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| format!("写入输入文件 {} 失败: {}", path, e))?;
    file.write_all(content)
        .map_err(|e| format!("写入输入文件 {} 失败: {}", path, e))
}

fn resolve_workspace_root(root: &str) -> Result<std::path::PathBuf, String> {
    let path = Path::new(root);
    if !path.is_absolute() || !path.is_dir() {
        return Err("判题配置错误: 工作区必须是已存在目录的绝对路径".into());
    }
    path.canonicalize()
        .map_err(|e| format!("判题配置错误: 无法解析工作区: {}", e))
}

fn copy_legacy_csv_assets(workspace: &Path, run_dir: &Path) -> Result<(), String> {
    // 与普通运行保持相同的工作区相对路径；不再从源码的祖先目录猜根目录。
    for relative in [
        "mcm/pandas_kit/data/level1_contest_raw.csv",
        "mcm/pandas_kit/data/level2_scores_raw.csv",
        "mcm/pandas_kit/data/level2_teams_raw.csv",
        "mcm/pandas_kit/data/practice_single.csv",
        "mcm/pandas_kit/data/practice_info.csv",
        "mcm/matplotlib_kit/data/year_trend.csv",
        "mcm/matplotlib_kit/data/school_summary.csv",
        "mcm/matplotlib_kit/data/score_hours.csv",
        "mcm/matplotlib_kit/data/team_scores.csv",
    ] {
        match std::fs::symlink_metadata(workspace.join(relative)) {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(error) => return Err(format!("准备判题输入失败 {}: {}", relative, error)),
            Ok(_) => {}
        }
        // 输入也拒绝经过链接/重解析点或越出显式工作区的路径。
        let source = crate::data_check::output_path(workspace, relative)
            .map_err(|e| format!("准备判题输入失败 {}: {}", relative, e))?;
        let content = std::fs::read(source)
            .map_err(|e| format!("准备判题输入失败 {}: {}", relative, e))?;
        write_input_asset(run_dir, relative, &content)?;
    }
    Ok(())
}

fn prepare_case_inputs(
    run_dir: &Path,
    lang: &str,
    case: &TestCase,
    workspace_root: Option<&Path>,
) -> Result<(), String> {
    if !case.input_assets.is_empty() {
        for asset in &case.input_assets {
            write_input_asset(run_dir, &asset.path, asset.content.as_bytes())?;
        }
    } else if lang == "python" || lang == "python3" {
        // 老调用方未传工作区时不猜路径；显式 input_assets 始终独立于工作区。
        if let Some(workspace) = workspace_root {
            copy_legacy_csv_assets(workspace, run_dir)?;
        }
    }
    Ok(())
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
    workspace_root: Option<String>,
) -> Result<Vec<CaseResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        judge_sync(code_path, lang, cases, workspace_root)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn judge_sync(
    code_path: String,
    lang: String,
    cases: Vec<TestCase>,
    workspace_root: Option<String>,
) -> Result<Vec<CaseResult>, String> {
    let workspace = workspace_root
        .as_deref()
        .map(resolve_workspace_root)
        .transpose()?;
    if lang == "sql" {
        return judge_sql(code_path, cases);
    }
    let build_temp = temp_dir()?;
    let dir = build_temp.path().to_path_buf();
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
                    return Err(format!(
                        "未检测到 {}，请先安装（如 w64devkit / MinGW）",
                        compiler
                    ));
                }
            };
            // 注意：内置 MinGW g++ 8.1 只支持到 C++17，写 c++20 会直接编译失败
            let std_flag = if lang == "c" {
                "-std=c17"
            } else {
                "-std=c++17"
            };
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
                return Err("编译超时".into());
            }
            if !result.success() || !out.is_file() {
                return Err(format!("编译失败:\n{}", result.failure_message()));
            }
            exe = Some(out);
        }
        "java" => {
            let javac = match find_tool("javac") {
                Some(p) => p,
                None => {
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
                return Err("编译超时".into());
            }
            if !result.success() || !dir.join("Main.class").is_file() {
                return Err(format!("编译失败:\n{}", result.failure_message()));
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
        }
        other => {
            // 第三方语言：从 langs/<lang>.json 注册表读取执行器声明（语言包插件标准）
            match load_lang_registry(&lang) {
                Some(spec) => {
                    exe = None;
                    custom_judge = Some(spec);
                }
                None => {
                    return Err(format!(
                        "暂不支持的语言: {}（也没有对应的语言包注册）",
                        other
                    ));
                }
            }
        }
    }

    let mut results = Vec::new();
    for (i, case) in cases.iter().enumerate() {
        let run_temp = temp_dir()?;
        let run_dir = run_temp.path().to_path_buf();
        let run_src = run_dir.join(src.file_name().unwrap());
        if let Some(bin) = &exe {
            std::fs::copy(bin, run_dir.join(bin.file_name().unwrap()))
                .map_err(|e| format!("准备运行程序失败: {}", e))?;
        } else if lang == "java" {
            for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
                let entry = entry.map_err(|e| e.to_string())?;
                if entry.path().extension().and_then(|ext| ext.to_str()) == Some("class") {
                    std::fs::copy(entry.path(), run_dir.join(entry.file_name()))
                        .map_err(|e| e.to_string())?;
                }
            }
        } else {
            std::fs::copy(&src, &run_src).map_err(|e| format!("准备运行代码失败: {}", e))?;
        }
        prepare_case_inputs(&run_dir, &lang, case, workspace.as_deref())?;
        let timeout = Duration::from_millis(case.timeout_ms.max(200));
        let outcome = match &exe {
            Some(bin) => {
                let mut cmd = Command::new(run_dir.join(bin.file_name().unwrap()));
                cmd.current_dir(&run_dir);
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
                        .arg(&run_dir)
                        .arg("Main");
                    cmd.current_dir(&run_dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(
                        cmd,
                        Some(case.stdin.clone()),
                        timeout + Duration::from_millis(1500),
                    )
                } else if lang == "go" {
                    // go run 编译+运行一体；GOCACHE 用数据目录持久缓存（首次编译标准库慢，临时缓存会拖累每次判题）
                    let go = find_tool("go").unwrap_or_else(|| "go".to_string());
                    let cache = crate::portable::data_dir().join("gocache");
                    let _ = std::fs::create_dir_all(&cache);
                    let mut cmd = Command::new(go);
                    cmd.arg("run").arg(&run_src);
                    cmd.current_dir(&run_dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    cmd.env("GOCACHE", &cache);
                    // go run 首次编译标准库可能超过 10s，给足编译余量
                    run_cmd(
                        cmd,
                        Some(case.stdin.clone()),
                        timeout + Duration::from_millis(8000),
                    )
                } else if lang == "javascript" || lang == "js" || lang == "node" {
                    let node = find_tool("node").unwrap_or_else(|| "node".to_string());
                    let mut cmd = Command::new(node);
                    cmd.arg(&run_src);
                    cmd.current_dir(&run_dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout)
                } else if let Some(spec) = &custom_judge {
                    // 第三方语言执行器：按语言包注册的模板运行（空白拆分，不经 shell）
                    let src_str = run_src.to_string_lossy().to_string();
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
                    cmd.current_dir(&run_dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(
                        cmd,
                        Some(case.stdin.clone()),
                        timeout + Duration::from_millis(spec.timeout_bonus_ms),
                    )
                } else {
                    let py = find_tool("python").unwrap_or_else(|| "python".to_string());
                    let mut cmd = Command::new(py);
                    cmd.arg(&run_src);
                    // pandas 题目用相对路径读 data/，必须锚定到判题目录
                    cmd.current_dir(&run_dir);
                    cmd.env("PATH", crate::portable::path_with_tools());
                    run_cmd(cmd, Some(case.stdin.clone()), timeout)
                }
            }
        };

        let result = if outcome.timed_out {
            CaseResult {
                index: i,
                pass: false,
                status: "超时".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: None,
                time_ms: outcome.time_ms,
            }
        } else if !outcome.success() {
            CaseResult {
                index: i,
                pass: false,
                status: "运行错误".into(),
                expected: Some(normalize(&case.expected_stdout)),
                actual: Some(outcome.failure_message()),
                time_ms: outcome.time_ms,
            }
        } else {
            let actual = normalize(&outcome.stdout);
            let expected = normalize(&case.expected_stdout);
            // contains 模式：pandas 等 DataFrame 输出格式随版本有差异，只校验关键子串
            let is_contains = case.match_mode.as_deref() == Some("contains");
            let passed = if (case.expect_file.is_some()
                || case.expect_json.is_some()
                || case.expect_csv.is_some())
                && expected.is_empty()
            {
                true // 纯文件产物题：stdout 不校验，交给产物校验器判定
            } else if is_contains {
                !expected.is_empty() && actual.contains(&expected)
            } else {
                actual == expected
            };
            CaseResult {
                index: i,
                pass: passed,
                status: if passed {
                    "通过".into()
                } else {
                    "答案错误".into()
                },
                expected: Some(expected),
                actual: Some(actual),
                time_ms: outcome.time_ms,
            }
        };
        let mut result = result;
        if outcome.success() {
            if let Some(ef) = &case.expect_file {
                let validation = (|| -> Result<(), String> {
                    let path = output_file(&run_dir, &ef.path)?;
                    let size = std::fs::metadata(&path)
                        .map_err(|error| error.to_string())?
                        .len();
                    if let Some(min) = ef.min_bytes {
                        if size < min {
                            return Err(format!("{} 仅 {} 字节（要求 ≥{}）", ef.path, size, min));
                        }
                    }
                    if let Some(want) = ef.dpi {
                        match png_dpi(&path) {
                            Some(dpi) if (dpi as i64 - want as i64).abs() <= 2 => {}
                            other => {
                                return Err(format!(
                                    "{} 的 dpi={:?}，要求 {}",
                                    ef.path, other, want
                                ));
                            }
                        }
                    }
                    Ok(())
                })();
                if let Err(note) = validation {
                    result.pass = false;
                    result.status = if note.starts_with("判题配置错误:") {
                        "判题服务错误".into()
                    } else {
                        "产物不符".into()
                    };
                    result.actual = Some(note);
                }
            }
            if result.pass {
                if let Some(spec) = &case.expect_json {
                    if let Err(note) = crate::data_check::validate_json(&run_dir, spec) {
                        result.pass = false;
                        result.status = if note.starts_with("判题配置错误:") {
                            "判题服务错误".into()
                        } else {
                            "产物不符".into()
                        };
                        result.actual = Some(note);
                    }
                }
            }
            if result.pass {
                if let Some(spec) = &case.expect_csv {
                    if let Err(note) = crate::data_check::validate_csv(&run_dir, spec) {
                        result.pass = false;
                        result.status = if note.starts_with("判题配置错误:") {
                            "判题服务错误".into()
                        } else {
                            "产物不符".into()
                        };
                        result.actual = Some(note);
                    }
                }
            }
        }
        results.push(result);
    }

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

fn output_file(dir: &Path, path: &str) -> Result<std::path::PathBuf, String> {
    crate::data_check::output_path(dir, path)
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
    let mut results = Vec::new();

    for (i, case) in cases.iter().enumerate() {
        let conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
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
            let mut stmt = conn
                .prepare(&sql)
                .map_err(|e| format!("SQL 语法错误: {}", e))?;
            let col_count = stmt.column_count();
            let names: Vec<String> = stmt
                .column_names()
                .into_iter()
                .map(|s| s.to_string())
                .collect();
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
                    status: if passed {
                        "通过".into()
                    } else {
                        "答案错误".into()
                    },
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

    fn test_case(expected: &str) -> TestCase {
        TestCase {
            stdin: String::new(),
            expected_stdout: expected.into(),
            timeout_ms: 3000,
            match_mode: None,
            expect_file: None,
            setup_sql: None,
            input_assets: vec![],
            expect_json: None,
            expect_csv: None,
        }
    }

    fn judge_javascript(source: &str, cases: Vec<TestCase>) -> Vec<CaseResult> {
        let dir = temp_dir().unwrap();
        let nested = dir.path().join("中文 路径").join("deeper");
        std::fs::create_dir_all(&nested).unwrap();
        let script = nested.join("solution test.js");
        std::fs::write(&script, source).unwrap();
        judge_sync(script.to_string_lossy().into(), "javascript".into(), cases, None).unwrap()
    }

    fn csv_case() -> TestCase {
        let mut case = test_case("");
        case.expect_csv = Some(crate::db::ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"001", "score":2.0})],
            key_columns: vec!["id".into()],
            abs_tol: 1e-6,
            rel_tol: 0.0,
        });
        case
    }

    #[test]
    fn judge_rejects_matching_output_followed_by_exception() {
        let mut case = test_case("42");
        case.match_mode = Some("contains".into());
        let results = judge_javascript("console.log(42); throw new Error('after output');", vec![case]);
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "运行错误");
        assert!(results[0].actual.as_deref().unwrap_or("").contains("after output"));
    }

    #[test]
    fn judge_rejects_nonzero_exit_with_empty_expected_output() {
        let results = judge_javascript("process.exit(7);", vec![test_case("")]);
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "运行错误");
    }

    #[test]
    fn runtime_failure_is_not_overwritten_by_missing_artifacts() {
        let mut case = csv_case();
        case.expect_file = Some(crate::db::ExpectFile {
            path: "missing.txt".into(), min_bytes: Some(1), dpi: None,
        });
        let results = judge_javascript("throw new Error('failed before export');", vec![case]);
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "运行错误");
        assert!(results[0].actual.as_deref().unwrap_or("").contains("failed before export"));
    }

    #[test]
    fn invalid_csv_contract_is_a_judge_service_error() {
        let mut case = csv_case();
        case.expect_csv.as_mut().unwrap().columns.clear();
        let results = judge_javascript("", vec![case]);
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "判题服务错误");
        assert!(results[0].actual.as_deref().unwrap_or("").starts_with("判题配置错误:"));
    }

    #[test]
    fn judge_allows_successful_program_with_warning_on_stderr() {
        let results = judge_javascript("console.error('warning'); console.log(42);", vec![test_case("42")]);
        assert!(results[0].pass, "{:?}", results[0]);
    }

    #[test]
    fn timeout_is_not_overwritten_by_missing_artifact_checks() {
        let mut case = csv_case();
        case.timeout_ms = 200;
        case.expect_file = Some(crate::db::ExpectFile {
            path: "missing.txt".into(), min_bytes: Some(1), dpi: None,
        });
        case.expect_json = Some(crate::db::ExpectJson {
            path: "missing.json".into(), value: serde_json::json!({}), abs_tol: 0.0, rel_tol: 0.0,
        });
        let results = judge_javascript("setInterval(() => {}, 1000);", vec![case]);
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "超时");
    }

    #[test]
    fn artifact_from_previous_case_cannot_satisfy_next_case() {
        let mut first = csv_case();
        first.stdin = "write".into();
        let second = csv_case();
        let source = r#"const fs = require('fs');
if (fs.readFileSync(0, 'utf8') === 'write') fs.writeFileSync('out.csv', 'id,score\n001,2\n');"#;
        let results = judge_javascript(source, vec![first, second]);
        assert!(results[0].pass, "{:?}", results[0]);
        assert!(!results[1].pass);
        assert_eq!(results[1].status, "产物不符");
        assert!(results[1].actual.as_deref().unwrap_or("").contains("产物缺失"));
    }

    #[test]
    fn printing_answers_or_writing_incorrect_csv_cannot_pass() {
        for source in [
            "console.log('id,score\\n001,2');",
            "require('fs').writeFileSync('out.csv', '');",
            "require('fs').writeFileSync('out.csv', 'id,wrong\\n001,2\\n');",
            "require('fs').writeFileSync('out.csv', 'id,score\\n001,999\\n');",
        ] {
            let results = judge_javascript(source, vec![csv_case()]);
            assert!(!results[0].pass, "incorrect program passed: {source}");
            assert_eq!(results[0].status, "产物不符");
        }
    }

    #[test]
    fn explicit_inputs_change_between_cases_and_support_equivalent_programs() {
        for source in [
            r#"const fs = require('fs'); const xs = JSON.parse(fs.readFileSync('data/input.json', 'utf8'));
const total = xs.reduce((sum, value) => sum + value, 0);
fs.writeFileSync('out.json', JSON.stringify({total}));"#,
            r#"const fs = require('fs'); const xs = JSON.parse(fs.readFileSync('data/input.json', 'utf8'));
let total = 0; for (const x of xs) total += x;
fs.writeFileSync('out.json', JSON.stringify({total}));"#,
        ] {
            let cases = [("[1,2]", 3), ("[9,-2,4]", 11)].into_iter().map(|(input, total)| {
                let mut case = test_case("");
                case.input_assets.push(crate::db::InputAsset {
                    path: "data/input.json".into(), content: input.into(),
                });
                case.expect_json = Some(crate::db::ExpectJson {
                    path: "out.json".into(), value: serde_json::json!({"total":total}), abs_tol: 0.0, rel_tol: 0.0,
                });
                case
            }).collect();
            let results = judge_javascript(source, cases);
            assert_eq!(results.len(), 2);
            assert!(results.iter().all(|result| result.pass), "{results:?}");
        }
    }

    #[test]
    fn legacy_assets_copy_only_named_training_inputs() {
        let workspace = temp_dir().unwrap();
        std::fs::create_dir_all(workspace.path().join("bank")).unwrap();
        let data = workspace.path().join("mcm/pandas_kit/data");
        std::fs::create_dir_all(&data).unwrap();
        for name in ["level1_contest_raw.csv", "practice_single.csv", "practice_info.csv", "practice_answers.csv", "exam_main.csv", "level1_clean.csv"] {
            std::fs::write(data.join(name), "id\n001\n").unwrap();
        }
        let nested = workspace.path().join("中文 作业/deep");
        std::fs::create_dir_all(&nested).unwrap();
        let script = nested.join("solution.py");
        std::fs::write(&script, "pass").unwrap();
        let run = temp_dir().unwrap();
        copy_legacy_csv_assets(workspace.path(), run.path()).unwrap();
        let copied = run.path().join("mcm/pandas_kit/data");
        assert!(copied.join("level1_contest_raw.csv").is_file());
        assert!(copied.join("practice_single.csv").is_file());
        assert!(copied.join("practice_info.csv").is_file());
        assert!(!copied.join("practice_answers.csv").exists());
        assert!(!copied.join("exam_main.csv").exists());
        assert!(!copied.join("level1_clean.csv").exists());
    }

    #[test]
    fn workspace_root_must_be_existing_absolute_directory() {
        let workspace = temp_dir().unwrap();
        let canonical = workspace.path().canonicalize().unwrap();
        let resolved = resolve_workspace_root(canonical.to_string_lossy().as_ref()).unwrap();
        assert_eq!(resolved, canonical);
        assert!(resolve_workspace_root("relative/workspace").is_err());
        assert!(resolve_workspace_root(
            workspace.path().join("missing").to_string_lossy().as_ref()
        ).is_err());
    }

    #[test]
    fn legacy_assets_use_explicit_workspace_not_code_ancestors() {
        let workspace = temp_dir().unwrap();
        let declared = workspace.path().join("mcm/pandas_kit/data");
        std::fs::create_dir_all(&declared).unwrap();
        std::fs::write(declared.join("level1_contest_raw.csv"), "declared").unwrap();
        let code = workspace.path().join("中文 作业/deep/bank/mcm");
        std::fs::create_dir_all(code.join("mcm/pandas_kit/data")).unwrap();
        std::fs::write(code.join("mcm/pandas_kit/data/level1_contest_raw.csv"), "guessed").unwrap();
        let run = temp_dir().unwrap();
        let root = resolve_workspace_root(workspace.path().to_string_lossy().as_ref()).unwrap();
        copy_legacy_csv_assets(&root, run.path()).unwrap();
        let copied = std::fs::read_to_string(run.path().join("mcm/pandas_kit/data/level1_contest_raw.csv")).unwrap();
        assert_eq!(copied, "declared");
    }

    #[test]
    fn input_assets_cannot_escape_or_overwrite_existing_files() {
        let dir = temp_dir().unwrap();
        assert!(write_input_asset(dir.path(), "../outside.csv", b"bad").is_err());
        assert!(write_input_asset(dir.path(), "C:/outside.csv", b"bad").is_err());
        write_input_asset(dir.path(), "data/input.csv", b"original").unwrap();
        assert!(write_input_asset(dir.path(), "data/input.csv", b"replacement").is_err());
        assert_eq!(std::fs::read(dir.path().join("data/input.csv")).unwrap(), b"original");
    }

    #[test]
    fn run_cmd_requires_successful_exit_not_stderr() {
        let mut cmd = Command::new(find_tool("node").unwrap());
        cmd.arg("-e")
            .arg("console.error(\"warning\");console.log(42)");
        let outcome = run_cmd(cmd, None, Duration::from_secs(3));
        assert!(outcome.success());
        assert_eq!(normalize(&outcome.stdout), "42");
    }

    #[test]
    fn nonzero_exit_is_failure_even_with_stdout() {
        let mut cmd = Command::new(find_tool("node").unwrap());
        cmd.arg("-e").arg("console.log(42);process.exit(7)");
        let outcome = run_cmd(cmd, None, Duration::from_secs(3));
        assert!(!outcome.success());
        assert_eq!(outcome.exit_status.unwrap().code(), Some(7));
    }

    #[test]
    fn timeout_and_directory_are_tracked() {
        let mut cmd = Command::new(find_tool("node").unwrap());
        cmd.arg("-e").arg("setInterval(()=>{},1000)");
        let outcome = run_cmd(cmd, None, Duration::from_millis(200));
        assert!(outcome.timed_out);
        assert!(!outcome.success());
        let first = temp_dir().unwrap();
        let path = first.path().to_path_buf();
        let second = temp_dir().unwrap();
        assert_ne!(path, second.path());
        drop(first);
        assert!(!path.exists());
    }

    #[cfg(windows)]
    #[test]
    fn job_attach_failure_stops_process_instead_of_running_unbounded() {
        FORCE_JOB_ATTACH_FAILURE.with(|flag| flag.set(true));
        let mut cmd = Command::new(find_tool("node").unwrap());
        cmd.arg("-e").arg("setInterval(()=>{},1000)");
        let outcome = run_cmd(cmd, None, Duration::from_secs(3));
        FORCE_JOB_ATTACH_FAILURE.with(|flag| flag.set(false));
        assert!(!outcome.success());
        assert!(
            outcome.failed_to_start.is_some(),
            "Job 附加失败必须显式失败，而不是静默降级: {:?}",
            outcome.failed_to_start
        );
        assert!(outcome.exit_status.is_none());
        assert!(!outcome.timed_out);
    }

    #[test]
    fn each_sql_case_uses_a_fresh_database() {
        let dir = temp_dir().unwrap();
        let sql = dir.path().join("q.sql");
        std::fs::write(&sql, "SELECT a FROM t ORDER BY a;").unwrap();
        let make_case = |value: i32| crate::db::TestCase {
            stdin: String::new(),
            expected_stdout: format!("a\n{value}"),
            timeout_ms: 1000,
            match_mode: None,
            expect_file: None,
            setup_sql: Some(format!("CREATE TABLE t(a INTEGER);INSERT INTO t VALUES({value});")),
            input_assets: vec![],
            expect_json: None,
            expect_csv: None,
        };
        let result = judge_sql(sql.to_string_lossy().into(), vec![make_case(1), make_case(2)]).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|case| case.pass));
        assert_eq!(result[0].actual.as_deref(), Some("a\n1"));
        assert_eq!(result[1].actual.as_deref(), Some("a\n2"));
    }

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
    fn png_dpi_reads_phys_chunk() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        fn chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
            png.extend_from_slice(&(data.len() as u32).to_be_bytes());
            png.extend_from_slice(kind);
            png.extend_from_slice(data);
            png.extend_from_slice(&[0, 0, 0, 0]); // 此测试只覆盖现有元数据读取器，不验证 PNG CRC。
        }
        chunk(&mut png, b"IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
        chunk(&mut png, b"pHYs", &[0, 0, 0x2E, 0x13, 0, 0, 0x2E, 0x13, 1]);
        chunk(&mut png, b"IEND", &[]);
        let dir = temp_dir().unwrap();
        let file = dir.path().join("image.png");
        std::fs::write(&file, png).unwrap();
        assert_eq!(png_dpi(&file), Some(300));
    }

    #[test]
    fn png_dpi_none_for_bad_file() {
        let dir = temp_dir().unwrap();
        let file = dir.path().join("bad.png");
        std::fs::write(&file, b"not a png").unwrap();
        assert_eq!(png_dpi(&file), None);
    }

    #[test]
    fn judge_sql_select_and_reject_non_query() {
        let dir = temp_dir().unwrap();
        let file = dir.path().join("query.sql");
        std::fs::write(&file, "SELECT a FROM t ORDER BY a;").unwrap();
        let mut case = test_case("a\n1\n2");
        case.setup_sql = Some("CREATE TABLE t(a INTEGER);INSERT INTO t VALUES(2),(1);".into());
        let results = judge_sql(file.to_string_lossy().into(), vec![case.clone()]).unwrap();
        assert!(results[0].pass, "{:?}", results[0]);
        std::fs::write(&file, "DELETE FROM t;").unwrap();
        let results = judge_sql(file.to_string_lossy().into(), vec![case]).unwrap();
        assert!(!results[0].pass);
        assert_eq!(results[0].status, "运行错误");
        assert!(results[0].actual.as_deref().unwrap_or("").contains("SELECT"));
    }

    #[test]
    fn output_file_rejects_unsafe_paths() {
        let dir = temp_dir().unwrap();
        assert!(output_file(dir.path(), "../escape.csv").is_err());
        assert!(output_file(dir.path(), "C:/escape.csv").is_err());
        std::fs::write(dir.path().join("ok.csv"), "x\n1\n").unwrap();
        assert!(output_file(dir.path(), "ok.csv").is_ok());
    }
}

/// 读取第三方语言执行器注册（exe 同目录 langs/<lang>.json，由语言包安装时写入）
fn load_lang_registry(lang: &str) -> Option<crate::langpack::JudgeSpec> {
    let exe = std::env::current_exe().ok()?;
    let path = exe.parent()?.join("langs").join(format!("{}.json", lang));
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}
