use base64::Engine;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

/// 一个存活的 PTY 会话：master 保活、writer 供写入、killer 用于终止 shell
pub struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

impl Drop for Session {
    fn drop(&mut self) {
        let _ = self.killer.kill();
    }
}

#[derive(Default)]
pub struct PtyState(Mutex<Option<Session>>);

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 启动一个 PTY 会话（若已有旧会话则先杀掉）
#[tauri::command]
pub fn pty_start(
    app: AppHandle,
    state: State<PtyState>,
    shell: Option<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    let mut guard = lock(&state.0);
    if let Some(old) = guard.take() {
        drop(old); // Drop 会 kill 旧 shell
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = shell.unwrap_or_else(|| "powershell".to_string());
    let mut cmd = CommandBuilder::new(shell);
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    // 便携模式：让终端里的 gcc/python 也能从 Runtime/ 解析到
    let portable_path = crate::portable::path_with_tools();
    cmd.env("PATH", &portable_path);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    let killer = child.clone_killer();
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let master = pair.master;
    drop(pair.slave); // 尽早释放从端，保证退出时能读到 EOF

    // 独立线程持续读 PTY 输出，base64 编码后流式推给前端（避免 UTF-8 跨块断裂乱码）
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                    if app.emit("pty-output", encoded).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = app.emit("pty-exit", ());
    });

    *guard = Some(Session {
        master,
        writer,
        killer,
    });
    Ok(())
}

/// 前端键盘输入写入 PTY
#[tauri::command]
pub fn pty_write(state: State<PtyState>, data: String) -> Result<(), String> {
    let mut guard = lock(&state.0);
    if let Some(s) = guard.as_mut() {
        s.writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        let _ = s.writer.flush();
    }
    Ok(())
}

/// 前端分栏尺寸变化时同步 PTY 大小
#[tauri::command]
pub fn pty_resize(state: State<PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    let guard = lock(&state.0);
    if let Some(s) = guard.as_ref() {
        s.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
