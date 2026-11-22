//! 便携模式：exe 同目录存在 `.portable` 标记文件时：
//! - 数据（SQLite）存 exe 同目录 Data/
//! - 默认工作区为 exe 同目录 workspace/
//! - 工具链优先用 exe 同目录 Runtime/（w64devkit、python），再退系统 PATH
//! 目标：整个文件夹拷到 U 盘即用，零残留。

use std::path::PathBuf;
use std::process::Command as StdCommand;

pub fn exe_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
}

pub fn is_portable() -> bool {
    exe_dir()
        .map(|d| d.join(".portable").exists())
        .unwrap_or(false)
}

pub fn data_dir() -> PathBuf {
    if is_portable() {
        if let Some(d) = exe_dir() {
            let data = d.join("Data");
            let _ = std::fs::create_dir_all(&data);
            return data;
        }
    }
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let dir = PathBuf::from(appdata).join("com.learnplatform.app");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// 便携模式下优先使用的工具目录（仅保留存在的）
pub fn tool_dirs() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(d) = exe_dir() {
        for rel in [
            "Runtime/w64devkit/bin",
            "Runtime/jdk/bin",
            "Runtime/go/bin",
            "Runtime/node",
            "Runtime/python",
            "Runtime/python/Scripts",
            "Runtime/bin",
        ] {
            let p = d.join(rel);
            if p.is_dir() {
                v.push(p);
            }
        }
    }
    v
}

/// 解析可执行文件：便携 Runtime 优先，然后系统 PATH
/// 返回可直接传给 Command::new 的字符串（要么是绝对路径，要么是命令名）
pub fn find_tool(name: &str) -> Option<String> {
    let exe_name = format!("{}.exe", name);
    for d in tool_dirs() {
        let cand = d.join(&exe_name);
        if cand.exists() {
            return Some(cand.to_string_lossy().to_string());
        }
        let cand_no_ext = d.join(name);
        if cand_no_ext.exists() {
            return Some(cand_no_ext.to_string_lossy().to_string());
        }
    }
    // 系统 PATH
    let out = StdCommand::new("where").arg(&exe_name).output().ok()?;
    if out.status.success() {
        let first = String::from_utf8_lossy(&out.stdout)
            .lines()
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        if !first.is_empty() {
            return Some(first);
        }
    }
    None
}

/// 给子进程用的 PATH：便携工具目录前置，保证 DLL 能被找到
pub fn path_with_tools() -> String {
    let mut parts: Vec<String> = tool_dirs()
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    if let Ok(path) = std::env::var("PATH") {
        parts.push(path);
    }
    parts.join(";")
}

/// 默认工作区：便携模式落在 exe 同目录 workspace/，否则用户目录 learn-workspace
pub fn default_workspace() -> PathBuf {
    if is_portable() {
        if let Some(d) = exe_dir() {
            let ws = d.join("workspace");
            let _ = std::fs::create_dir_all(&ws);
            return ws;
        }
    }
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:/".into());
    let ws = PathBuf::from(home).join("learn-workspace");
    let _ = std::fs::create_dir_all(&ws);
    // 首次使用：工作区为空时，从 exe 同目录 workspace-template/ 播种（开源仓库自带模板）
    if std::fs::read_dir(&ws).map(|mut r| r.next().is_none()).unwrap_or(false) {
        if let Some(d) = exe_dir() {
            let tpl = d.join("workspace-template");
            if tpl.is_dir() {
                copy_dir(&tpl, &ws);
            }
        }
    }
    ws
}

/// 递归复制目录（种子模板用，隐藏文件跳过）
fn copy_dir(src: &std::path::Path, dst: &std::path::Path) {
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
                copy_dir(&p, &target);
            } else {
                let _ = std::fs::copy(&p, &target);
            }
        }
    }
}

/// 前端启动时读取：是否便携、数据目录、默认工作区
#[tauri::command]
pub fn app_info() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "portable": is_portable(),
        "exeDir": exe_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default(),
        "dataDir": data_dir().to_string_lossy().to_string(),
        "defaultWorkspace": default_workspace().to_string_lossy().to_string(),
        "toolDirs": tool_dirs().iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>(),
    })
}
